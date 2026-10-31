"""Phase 0 check: Sun/Earth az/el from a lunar surface site, SPICE vs JPL Horizons.

Usage: python pipeline/validate_horizons.py
"""
import os

import numpy as np
import requests
import spiceypy as sp

KERNEL_DIR = os.environ.get("AS75_KERNELS", r"C:\nasa-data\kernels")
KERNELS = [
    "naif0012.tls",
    "pck00011.tpc",
    "de440s.bsp",
    "moon_pa_de440_200625.bpc",
    "moon_de440_250416.tf",
]
MOON_R_KM = 1737.4
HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api"

# (name, lat deg, east lon deg, height above sphere km) -- test points only
SITES = [
    ("South pole test (89.45S, 222.7E)", -89.45, 222.7, 0.0),
    ("Apollo 11", 0.67408, 23.47297, 0.0),
]
BODIES = [("SUN", "10"), ("EARTH", "399")]


def load_kernels():
    for k in KERNELS:
        sp.furnsh(os.path.join(KERNEL_DIR, k))


def site_vector(lat, lon, h_km):
    return np.array(sp.latrec(MOON_R_KM + h_km, np.radians(lon), np.radians(lat)))


def spice_azel(body, utc, lat, lon, h_km):
    """Apparent az (N->E, deg) and el (deg) of body seen from a fixed MOON_ME site."""
    et = sp.str2et(utc + " UTC")
    azl, _ = sp.azlcpo("ELLIPSOID", body, et, "LT+S", False, True,
                       site_vector(lat, lon, h_km), "MOON", "MOON_ME")
    return np.degrees(azl[1]) % 360.0, np.degrees(azl[2])


def horizons_azel(cmd, start, stop, step, lat, lon, h_km):
    params = {
        "format": "json", "COMMAND": f"'{cmd}'", "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER", "CENTER": "'coord@301'",
        "COORD_TYPE": "GEODETIC", "SITE_COORD": f"'{lon},{lat},{h_km}'",
        "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'", "QUANTITIES": "'4'", "ANG_FORMAT": "DEG",
        "EXTRA_PREC": "YES", "CSV_FORMAT": "YES", "TIME_DIGITS": "MINUTES",
    }
    text = requests.get(HORIZONS_API, params=params, timeout=60).json()["result"]
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    out = []
    for r in rows:
        cols = [c.strip() for c in r.split(",")]
        nums = [c for c in cols[1:] if c and c.lstrip("-").replace(".", "").isdigit()]
        out.append((cols[0], float(nums[0]), float(nums[1])))
    return out


def angdiff(a, b):
    return (a - b + 180.0) % 360.0 - 180.0


def main():
    load_kernels()
    start, stop, step = "2026-11-01 00:00", "2026-12-01 00:00", "12h"
    worst = 0.0
    for name, lat, lon, h in SITES:
        print(f"\n=== {name}  lat={lat} lon={lon}E ===")
        for body, cmd in BODIES:
            hz = horizons_azel(cmd, start, stop, step, lat, lon, h)
            daz, del_ = [], []
            for t, haz, hel in hz:
                saz, sel = spice_azel(body, t.replace("A.D. ", ""), lat, lon, h)
                # azimuth error scaled by cos(el) = true angular error on the sky
                daz.append(abs(angdiff(saz, haz)) * np.cos(np.radians(hel)))
                del_.append(abs(sel - hel))
            t0, haz0, hel0 = hz[0]
            saz0, sel0 = spice_azel(body, t0, lat, lon, h)
            print(f"  {body:5s} @ {t0}: SPICE az={saz0:8.3f} el={sel0:7.3f} | "
                  f"Horizons az={haz0:8.3f} el={hel0:7.3f}")
            print(f"        max |d_el| = {max(del_):.4f} deg, "
                  f"max |d_az|*cos(el) = {max(daz):.4f} deg over {len(hz)} samples")
            worst = max(worst, max(del_), max(daz))
    print(f"\nWORST DIFFERENCE: {worst:.4f} deg  ->  {'PASS' if worst < 0.01 else 'CHECK'}")


if __name__ == "__main__":
    main()
