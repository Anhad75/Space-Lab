"""Write hourly Sun/Earth geometry in the MOON_ME frame, one binary file per year.

Each file  web/public/data/ephem/<year>.bin  is little-endian float32, records of 6:
    sun_x, sun_y, sun_z        unit vector Moon centre -> Sun (MOON_ME)
    earth_x, earth_y, earth_z  vector Moon centre -> Earth in km (MOON_ME)
Record i is at  Jan 1 <year> 00:00 UTC + i hours, running through Jan 1 of the
next year inclusive so the browser can interpolate across the boundary.
"""
import json
from datetime import datetime, timezone

import numpy as np
import spiceypy as sp

from common import WEB_DATA, load_kernels

YEARS = list(range(1969, 1973)) + list(range(2023, 2033))


def year_records(year):
    t0 = datetime(year, 1, 1, tzinfo=timezone.utc)
    t1 = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    hours = int((t1 - t0).total_seconds() // 3600) + 1
    et0 = sp.str2et(f"{year}-01-01 00:00:00 UTC")
    out = np.empty((hours, 6), dtype=np.float32)
    for i in range(hours):
        # A leap second inside a year shifts later records by 1 s: negligible here.
        et = et0 + i * 3600.0
        sun, _ = sp.spkpos("SUN", et, "MOON_ME", "LT+S", "MOON")
        earth, _ = sp.spkpos("EARTH", et, "MOON_ME", "LT+S", "MOON")
        out[i, :3] = np.asarray(sun) / np.linalg.norm(sun)
        out[i, 3:] = earth
    return t0, out


def main():
    load_kernels()
    outdir = WEB_DATA / "ephem"
    outdir.mkdir(parents=True, exist_ok=True)
    index = {"stepHours": 1, "frame": "MOON_ME", "abcorr": "LT+S", "years": {}}
    for y in YEARS:
        t0, rec = year_records(y)
        rec.tofile(outdir / f"{y}.bin")
        index["years"][str(y)] = {"startMs": int(t0.timestamp() * 1000), "count": len(rec)}
        print(y, rec.shape)
    (outdir / "index.json").write_text(json.dumps(index, indent=1))


if __name__ == "__main__":
    main()
