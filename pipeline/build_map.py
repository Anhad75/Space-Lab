"""Render a south-pole hillshade PNG (polar stereographic) for the site-picker map.

web/public/data/map/south_hillshade.png covers +-HALF_KM around the pole; the map
metadata (extent, projection) goes in map/index.json.
"""
import json
import struct
import zlib

import numpy as np

from common import WEB_DATA
from dem import PolarDEM

HALF_KM = 200.0
SIZE = 1024


def write_png(path, gray):
    h, w = gray.shape
    raw = b"".join(b"\x00" + gray[i].tobytes() for i in range(h))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.write_bytes(png)


def main():
    dem = PolarDEM("ldem_60s_240m")
    # pixel grid in projection metres: row -> -x (toward lon 0 is up), col -> +y
    s = np.linspace(-HALF_KM * 1000, HALF_KM * 1000, SIZE)
    yy, xx = np.meshgrid(s, -s)          # xx: row coordinate, yy: col coordinate
    z = dem.height(xx, yy)
    px = 2 * HALF_KM * 1000 / (SIZE - 1)
    gy, gx = np.gradient(z, px)          # along rows, along cols
    # sun from the upper left, 35 deg high: a classic hillshade
    az, alt = np.radians(315), np.radians(35)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    # blend with height so craters read as dark basins
    zn = (z - np.nanpercentile(z, 2)) / (np.nanpercentile(z, 98) - np.nanpercentile(z, 2))
    img = np.clip(0.75 * np.clip(shade, 0, 1) + 0.25 * np.clip(zn, 0, 1), 0, 1)
    gray = (np.nan_to_num(img) * 235 + 10).astype(np.uint8)
    out = WEB_DATA / "map"
    out.mkdir(parents=True, exist_ok=True)
    write_png(out / "south_hillshade.png", gray)
    (out / "index.json").write_text(json.dumps({
        "file": "south_hillshade.png", "size": SIZE, "halfKm": HALF_KM,
        "note": "row grows away from lon 0 (lon 0 at top), col grows toward lon 90E"}))
    print("map written", gray.shape)


if __name__ == "__main__":
    main()
