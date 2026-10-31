"""Precompute terrain horizon masks for curated sites + export a browser DEM.

Outputs (web/public/data):
  sites.json            site catalogue with terrain height and mask file name
  horizons/<id>.bin     float32 [len(MASTS)][N_AZ] horizon elevation (deg),
                        azimuth i*360/N_AZ measured N->E
  dem/south_<res>m.bin  int16 heights (m) in south polar stereographic,
                        described by dem/index.json, for live custom-site masks
"""
import json

import numpy as np

from common import WEB_DATA
from dem import PolarDEM, Terrain, unit_from_latlon
from optimize_sites import local_slope_deg
from sites import SITES

N_AZ = 720
MASTS = [1.0, 2.0, 5.0, 10.0, 20.0, 50.0]


def build_site_masks(terrain):
    outdir = WEB_DATA / "horizons"
    outdir.mkdir(parents=True, exist_ok=True)
    catalogue = []
    near = PolarDEM("ldem_80s_40m")
    for s in SITES:
        masks = np.stack([terrain.horizon(s["lat"], s["lon"], mast_m=m, n_az=N_AZ)
                          for m in MASTS]).astype(np.float32)
        masks.tofile(outdir / f"{s['id']}.bin")
        entry = dict(s, heightM=round(terrain.site_height(s["lat"], s["lon"]), 1),
                     demStepM=round(terrain.step_m(s["lat"], s["lon"]), 1))
        if near.contains_unit(unit_from_latlon(s["lat"], s["lon"])[None])[0]:
            entry["slopeDeg"] = round(local_slope_deg(near, s["lat"], s["lon"]), 1)
        catalogue.append(entry)
        print(f"{s['name']:32s} h={entry['heightM']:7.0f} m  "
              f"horizon(2 m) mean {masks[1].mean():5.2f}  max {masks[1].max():5.2f} deg")
    meta = {"nAz": N_AZ, "masts": MASTS, "sites": catalogue}
    (WEB_DATA / "sites.json").write_text(json.dumps(meta, indent=1))


def export_browser_dem():
    """Two nested layers cut from the 240 m polar map: fine near the pole, coarse wider."""
    src = PolarDEM("ldem_60s_240m")
    outdir = WEB_DATA / "dem"
    outdir.mkdir(parents=True, exist_ok=True)
    layers = []
    # (half-width in km, decimation factor) -> 240 m to ~85S, 480 m to ~73S
    for half_km, dec in [(155.0, 1), (520.0, 2)]:
        half_px = int(half_km * 1000 / src.scale_m)
        half_px -= half_px % dec
        c = int(src.c + 0.5)
        block = np.asarray(src.data[c - half_px:c + half_px, c - half_px:c + half_px], dtype=np.float32)
        if dec > 1:
            n = block.shape[0] // dec
            block = block[:n * dec, :n * dec].reshape(n, dec, n, dec).mean(axis=(1, 3))
        heights = np.round(block * src.dn_scale).astype("<i2")
        name = f"south_{int(src.scale_m * dec)}m.bin"
        heights.tofile(outdir / name)
        n = heights.shape[0]
        layers.append({"file": name, "n": n, "scaleM": src.scale_m * dec,
                       "center": (n - 1) / 2.0})
        print(f"browser DEM {name}: {n}x{n}, {heights.nbytes / 1e6:.1f} MB")
    (outdir / "index.json").write_text(json.dumps({
        "projection": "south polar stereographic, R=1737.4 km; "
                      "row = center - x/scale, col = center + y/scale, "
                      "x = 2R*ux/(1-uz), y = 2R*uy/(1-uz)",
        "layers": layers}, indent=1))


if __name__ == "__main__":
    build_site_masks(Terrain())
    export_browser_dem()
