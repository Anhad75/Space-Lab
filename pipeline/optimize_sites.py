"""Find the best-lit, landable point near each approximate Artemis III region point.

For every candidate on a grid around the region point we compute the 40 m slope and
the terrain horizon, then the sunlit fraction over 2027-2028 (2-hourly). Among
candidates with slope <= MAX_SLOPE we keep the one with the most sunlight.
Writes pipeline/optimized_sites.json, which sites.py applies on top of SITES.
"""
import json
from pathlib import Path

import numpy as np

from common import WEB_DATA
from dem import PolarDEM, Terrain, enu_basis, unit_from_latlon
from sites import RAW_SITES

SEARCH_KM = 6.0
SPACING_KM = 0.6
MAX_SLOPE = 8.0
OUT = Path(__file__).with_name("optimized_sites.json")


def local_slope_deg(dem, lat, lon, baseline_m=120.0):
    """Max slope from central differences at +-baseline/2 along east and north."""
    up, east, north = enu_basis(lat, lon)
    hb = baseline_m / 2 / 1737400.0  # half-baseline as a unit-vector offset

    def h(vec):
        return float(dem.height_unit(vec[None])[0])

    def off(d_e, d_n):
        v = up + d_e * east + d_n * north
        return v / np.linalg.norm(v)

    dzdx = (h(off(hb, 0)) - h(off(-hb, 0))) / baseline_m
    dzdy = (h(off(0, hb)) - h(off(0, -hb))) / baseline_m
    return float(np.degrees(np.arctan(np.hypot(dzdx, dzdy))))


def sun_dirs():
    """Unit Sun vectors (MOON_ME), 2-hourly over 2027-2028, from the web ephemeris."""
    vecs = []
    for y in (2027, 2028):
        d = np.fromfile(WEB_DATA / "ephem" / f"{y}.bin", dtype="<f4").reshape(-1, 6)
        vecs.append(d[:-1:2, :3])
    return np.concatenate(vecs).astype(np.float64)


def sunlit_fraction(mask, lat, lon, sun):
    up, east, north = enu_basis(lat, lon)
    el = np.degrees(np.arcsin(sun @ up))
    az = np.degrees(np.arctan2(sun @ east, sun @ north)) % 360
    n = len(mask)
    hor = np.interp(az, np.arange(n + 1) * 360.0 / n, np.append(mask, mask[0]))
    return float(np.mean(el - hor > 0))


def main():
    terrain = Terrain(near_km=15.0)
    near = PolarDEM("ldem_80s_40m")
    sun = sun_dirs()
    results = {}
    for s in RAW_SITES:
        if s.get("group") != "Artemis III region":
            continue
        up, east, north = enu_basis(s["lat"], s["lon"])
        steps = np.arange(-SEARCH_KM, SEARCH_KM + 1e-9, SPACING_KM)
        best = None
        tried = 0
        for de in steps:
            for dn in steps:
                if np.hypot(de, dn) > SEARCH_KM:
                    continue
                v = up + (de * east + dn * north) / 1737.4
                v /= np.linalg.norm(v)
                lat = float(np.degrees(np.arcsin(v[2])))
                lon = float(np.degrees(np.arctan2(v[1], v[0])))
                slope = local_slope_deg(near, lat, lon)
                if slope > MAX_SLOPE:
                    continue
                tried += 1
                mask = terrain.horizon(lat, lon, mast_m=2.0, n_az=360, max_km=150.0)
                lit = sunlit_fraction(mask, lat, lon, sun)
                if best is None or lit > best["sunlit"]:
                    best = dict(lat=round(lat, 4), lon=round(lon, 4), slope=round(slope, 1),
                                sunlit=round(lit, 4))
        results[s["id"]] = best
        print(f"{s['name']:20s} {tried:4d} flat candidates -> {best}", flush=True)
    OUT.write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
