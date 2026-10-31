"""Write SPICE (azlcpo) reference az/el values used to test web/src/lib/geometry.js."""
import json

import numpy as np
import spiceypy as sp

from common import REPO, load_kernels
from dem import R_M, Terrain

CASES = [
    ("Connecting Ridge", -89.53432, 209.94767),
    ("IM-2", -84.7906, 29.1957),
    ("Apollo 11", 0.67408, 23.47297),
    ("Chang'e-4", -45.4446, 177.5991),
]
TIMES = ["1969-07-20 20:17:40", "2024-02-22 23:23:00", "2026-11-01 07:30:00",
         "2027-06-15 13:10:00", "2028-12-31 23:00:00", "2032-03-03 03:03:00"]


def main():
    load_kernels()
    terrain = Terrain()
    out = []
    for name, lat, lon in CASES:
        h = terrain.site_height(lat, lon)
        pos = np.array(sp.latrec((R_M + h) / 1000.0, np.radians(lon), np.radians(lat)))
        for utc in TIMES:
            et = sp.str2et(utc + " UTC")
            row = {"site": name, "lat": lat, "lon": lon, "heightM": h, "utc": utc + "Z"}
            for body in ("SUN", "EARTH"):
                azl, _ = sp.azlcpo("ELLIPSOID", body, et, "LT+S", False, True,
                                   pos, "MOON", "MOON_ME")
                row[body.lower()] = [np.degrees(azl[1]) % 360, np.degrees(azl[2])]
            out.append(row)
    path = REPO / "web" / "test" / "reference.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=1))
    print(f"wrote {len(out)} reference rows to {path}")


if __name__ == "__main__":
    main()
