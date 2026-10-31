"""Terrain validation: our illumination vs NASA PGDA average-visibility maps.

PGDA (Mazarico et al. 2011, 2016 release) gives, per 60 m pixel poleward of 85S,
the fraction of time any part of the solar disc (or Earth's disc) is visible,
computed from LOLA topography over a lunar nutation cycle. We compute the same
quantity with our own pipeline (SPICE + our horizon masks) over 18.6 years and
compare at the named sites and at random points across the polar cap.

Writes web/public/data/validation/pgda.json (for the app) and prints a summary.
"""
import json
import re
from pathlib import Path

import numpy as np
import spiceypy as sp

from common import DATA_DIR, WEB_DATA, load_kernels
from dem import R_M, Terrain, enu_basis, unit_from_latlon
from sites import SITES

PGDA_DIR = DATA_DIR / "pgda"
SUN_R_DEG = 0.2666
EARTH_R_KM = 6378.1
N_RANDOM = 300
MAST_M = 0.5  # just above the surface, like a per-pixel illumination model


class PgdaMap:
    def __init__(self, name):
        lbl = (PGDA_DIR / f"{name}.LBL").read_text()
        num = lambda k: float(re.search(rf"\b{k}\s*=\s*([-\d.]+)", lbl).group(1))
        self.n = int(num("LINE_SAMPLES"))
        self.scale_m = num("MAP_SCALE")
        self.c = num("LINE_PROJECTION_OFFSET")
        self.k = num("SCALING_FACTOR")
        self.data = np.fromfile(PGDA_DIR / f"{name}.IMG", dtype="<i2").reshape(self.n, self.n)

    def value(self, lat, lon):
        """Nearest-pixel value; same projection convention as the LOLA polar DEMs."""
        u = unit_from_latlon(lat, lon)
        k = 2.0 * R_M / (1.0 - u[2])
        x, y = k * u[0], k * u[1]
        r, c = int(round(self.c - x / self.scale_m)), int(round(self.c + y / self.scale_m))
        if not (0 <= r < self.n and 0 <= c < self.n):
            return None
        return float(self.data[r, c]) * self.k


def ephemeris(years=18.6, step_h=3.0):
    et0 = sp.str2et("2009-07-13 00:00 UTC")
    ets = et0 + np.arange(0, years * 365.25 * 24, step_h) * 3600.0
    sun = np.array([sp.spkpos("SUN", et, "MOON_ME", "LT+S", "MOON")[0] for et in ets])
    earth = np.array([sp.spkpos("EARTH", et, "MOON_ME", "LT+S", "MOON")[0] for et in ets])
    return sun / np.linalg.norm(sun, axis=1)[:, None], earth


def visible_fraction(mask, lat, lon, h_m, sun, earth):
    up, east, north = enu_basis(lat, lon)
    n = len(mask)
    grid = np.arange(n + 1) * 360.0 / n
    ring = np.append(mask, mask[0])

    def frac(vec, radius_deg):
        el = np.degrees(np.arcsin(np.clip(vec @ up, -1, 1)))
        az = np.degrees(np.arctan2(vec @ east, vec @ north)) % 360
        return float(np.mean(el + radius_deg > np.interp(az, grid, ring)))

    site = up * (R_M + h_m) / 1000.0
    ev = earth - site
    dist = np.linalg.norm(ev, axis=1)
    e_unit = ev / dist[:, None]
    e_rad = np.degrees(np.arcsin(EARTH_R_KM / dist))
    # Earth radius varies a little; use its mean for the "any part of the disc" test
    return frac(sun, SUN_R_DEG), frac(e_unit, float(e_rad.mean()))


def main():
    load_kernels()
    print("computing 18.6 years of Sun/Earth directions...")
    sun, earth = ephemeris()
    terrain = Terrain()
    pg_sun = PgdaMap("AVGVISIB_85S_060M_201608")
    pg_earth = PgdaMap("AVGVISIB_85S_060M_201608_EARTH")

    def evaluate(lat, lon):
        ps, pe = pg_sun.value(lat, lon), pg_earth.value(lat, lon)
        if ps is None:
            return None
        h = terrain.site_height(lat, lon)
        mask = terrain.horizon(lat, lon, mast_m=MAST_M, n_az=720)
        s, e = visible_fraction(mask, lat, lon, h + MAST_M, sun, earth)
        return dict(lat=round(lat, 4), lon=round(lon, 4), ours_sun=round(s, 4), pgda_sun=round(ps, 4),
                    ours_earth=round(e, 4), pgda_earth=round(pe, 4))

    named = []
    for s in SITES:
        r = evaluate(s["lat"], s["lon"])
        if r:
            r["name"] = s["name"]
            named.append(r)
            print(f"{s['name']:28s} sun ours {r['ours_sun']:.3f} pgda {r['pgda_sun']:.3f} | "
                  f"earth ours {r['ours_earth']:.3f} pgda {r['pgda_earth']:.3f}")

    rng = np.random.default_rng(75)
    rand = []
    while len(rand) < N_RANDOM:
        # uniform by area over the cap poleward of 85.3S (colatitude <= 4.7 deg)
        lat = -(90.0 - np.degrees(np.arccos(rng.uniform(np.cos(np.radians(4.7)), 1.0))))
        lon = rng.uniform(-180, 180)
        r = evaluate(float(lat), float(lon))
        if r:
            rand.append(r)

    def stats(rows, key):
        a = np.array([r[f"ours_{key}"] for r in rows])
        b = np.array([r[f"pgda_{key}"] for r in rows])
        d = a - b
        return dict(n=len(rows), meanAbsDiffPct=round(float(np.mean(np.abs(d))) * 100, 2),
                    medianAbsDiffPct=round(float(np.median(np.abs(d))) * 100, 2),
                    biasPct=round(float(np.mean(d)) * 100, 2),
                    r=round(float(np.corrcoef(a, b)[0, 1]), 4))

    lit = [r for r in rand if r["pgda_sun"] > 0.05]
    psr = [r for r in rand if r["pgda_sun"] < 0.01]
    within5 = np.mean([abs(r["ours_sun"] - r["pgda_sun"]) < 0.05 for r in lit])
    summary = {"sun": stats(rand, "sun"), "earth": stats(rand, "earth"),
               "sunLitOnly": {**stats(lit, "sun"), "within5PtsPct": round(float(within5) * 100, 1)},
               "psrAgree": f"{sum(r['ours_sun'] < 0.01 for r in psr)}/{len(psr)}"}
    print("random points:", json.dumps(summary))
    out = WEB_DATA / "validation"
    out.mkdir(parents=True, exist_ok=True)
    (out / "pgda.json").write_text(json.dumps({
        "source": "NASA PGDA Lunar Polar Illumination (Mazarico et al. 2011), AVGVISIB_85S_060M_201608 (+ _EARTH)",
        "definition": "fraction of time any part of the disc is visible; ours over 2009-07-13 + 18.6 y, 3-hourly, 0.5 m above ground",
        "summary": summary, "named": named, "random": rand}, indent=1))


if __name__ == "__main__":
    main()
