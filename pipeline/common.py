"""Shared constants and SPICE setup for the AS75 Lab pipeline."""
import os
from pathlib import Path

import spiceypy as sp

DATA_DIR = Path(os.environ.get("AS75_DATA", r"C:\nasa-data"))
KERNEL_DIR = DATA_DIR / "kernels"
DEM_DIR = DATA_DIR / "dem"
REPO = Path(__file__).resolve().parents[1]
WEB_DATA = REPO / "web" / "public" / "data"

KERNELS = [
    "naif0012.tls",
    "pck00011.tpc",
    "de440s.bsp",
    "moon_pa_de440_200625.bpc",
    "moon_de440_250416.tf",
]
MOON_R_KM = 1737.4

_loaded = False


def load_kernels():
    global _loaded
    if not _loaded:
        for k in KERNELS:
            sp.furnsh(str(KERNEL_DIR / k))
        _loaded = True
