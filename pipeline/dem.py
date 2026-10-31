"""LOLA south-polar stereographic DEM access and terrain horizon masks."""
import re

import numpy as np

from common import DEM_DIR, MOON_R_KM

R_M = MOON_R_KM * 1000.0


class PolarDEM:
    """A LOLA LDEM_xxS_yyM product: int16 heights (DN * 0.5 m) above a 1737.4 km sphere."""

    def __init__(self, name):
        lbl = (DEM_DIR / f"{name}.lbl").read_text()

        def num(key):
            return float(re.search(rf"\b{key}\s*=\s*([-\d.]+)", lbl).group(1))

        self.n = int(num("LINE_SAMPLES"))
        self.scale_m = num("MAP_SCALE")
        self.dn_scale = num("SCALING_FACTOR")
        self.c = num("LINE_PROJECTION_OFFSET")
        self.min_lat = num("MAXIMUM_LATITUDE")  # e.g. -80: the edge of the map
        self.data = np.memmap(DEM_DIR / f"{name}.img", dtype="<i2", mode="r",
                              shape=(self.n, self.n))

    def xy_from_unit(self, u):
        """Unit vector(s) in MOON_ME -> polar stereographic x, y in metres."""
        k = 2.0 * R_M / (1.0 - u[..., 2])  # south-pole projection
        return k * u[..., 0], k * u[..., 1]

    def rowcol(self, x, y):
        # x ~ cos(lon), y ~ sin(lon). Sample grows toward lon 90E, line shrinks
        # toward lon 0. Verified against Mons Mouton/Malapert (high) and
        # Cabeus/Haworth/Shackleton/de Gerlache (low).
        return self.c - x / self.scale_m, self.c + y / self.scale_m

    def contains(self, x, y):
        r, c = self.rowcol(x, y)
        return (r >= 0) & (c >= 0) & (r <= self.n - 2) & (c <= self.n - 2)

    def height(self, x, y):
        """Bilinear height (m above 1737.4 km sphere); NaN outside the map."""
        r, c = self.rowcol(np.asarray(x, float), np.asarray(y, float))
        ok = (r >= 0) & (c >= 0) & (r <= self.n - 2) & (c <= self.n - 2)
        r0 = np.where(ok, np.floor(r), 0).astype(np.int64)
        c0 = np.where(ok, np.floor(c), 0).astype(np.int64)
        fr, fc = r - r0, c - c0
        d = self.data
        h = ((1 - fr) * (1 - fc) * d[r0, c0] + (1 - fr) * fc * d[r0, c0 + 1]
             + fr * (1 - fc) * d[r0 + 1, c0] + fr * fc * d[r0 + 1, c0 + 1])
        return np.where(ok, h * self.dn_scale, np.nan)


class GlobalDEM:
    """A LOLA LDEM_<ppd> simple-cylindrical product (lon 0..360 E, lat 90..-90)."""

    def __init__(self, name):
        lbl = (DEM_DIR / f"{name}.lbl").read_text()
        num = lambda k: float(re.search(rf"\b{k}\s*=\s*([-\d.]+)", lbl).group(1))
        self.ppd = num("MAP_RESOLUTION")
        self.rows, self.cols = int(num("LINES")), int(num("LINE_SAMPLES"))
        self.dn_scale = num("SCALING_FACTOR")
        self.scale_m = np.radians(1.0 / self.ppd) * R_M
        self.data = np.memmap(DEM_DIR / f"{name}.img", dtype="<i2", mode="r",
                              shape=(self.rows, self.cols))

    def contains_unit(self, u):
        return np.ones(u.shape[:-1], bool)

    def height_unit(self, u):
        lat = np.degrees(np.arcsin(np.clip(u[..., 2], -1, 1)))
        lon = np.degrees(np.arctan2(u[..., 1], u[..., 0])) % 360.0
        r = np.clip((90.0 - lat) * self.ppd - 0.5, 0, self.rows - 1.001)
        c = lon * self.ppd - 0.5
        r0, c0 = np.floor(r).astype(np.int64), np.floor(c).astype(np.int64)
        fr, fc = r - r0, c - c0
        c0w, c1w = c0 % self.cols, (c0 + 1) % self.cols
        d = self.data
        h = ((1 - fr) * (1 - fc) * d[r0, c0w] + (1 - fr) * fc * d[r0, c1w]
             + fr * (1 - fc) * d[r0 + 1, c0w] + fr * fc * d[r0 + 1, c1w])
        return h * self.dn_scale


def _polar_contains_unit(self, u):
    return self.contains(*self.xy_from_unit(u))


def _polar_height_unit(self, u):
    return self.height(*self.xy_from_unit(u))


PolarDEM.contains_unit = _polar_contains_unit
PolarDEM.height_unit = _polar_height_unit


def unit_from_latlon(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def enu_basis(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    return up, east, north


class Terrain:
    """Stack of DEM layers; each sample uses the first layer that covers it.

    Layers are (dem, max_dist_km): the 40 m map is only used near the site, where
    its detail matters; coarser maps cover the far field.
    """

    def __init__(self, near_km=25.0):
        self.near_km = near_km
        self.layers = [
            (PolarDEM("ldem_80s_40m"), near_km),
            (PolarDEM("ldem_60s_240m"), np.inf),
            (GlobalDEM("ldem_16"), np.inf),
        ]

    def height_at_unit(self, u, dist_km=None):
        u = np.broadcast_to(u, np.broadcast_shapes(u.shape, (1,) * (u.ndim - 1) + (3,)))
        h = np.full(u.shape[:-1], np.nan)
        dist = np.zeros(u.shape[:-1]) if dist_km is None else np.broadcast_to(dist_km, h.shape)
        for dem, max_km in self.layers:
            todo = np.isnan(h) & (dist <= max_km)
            if not todo.any():
                continue
            sub = u[todo]
            ok = dem.contains_unit(sub)
            vals = np.full(len(sub), np.nan)
            if ok.any():
                vals[ok] = dem.height_unit(sub[ok])
            h[todo] = vals
        return h

    def site_height(self, lat, lon):
        return float(self.height_at_unit(unit_from_latlon(lat, lon)[None])[0])

    def step_m(self, lat, lon):
        """Finest DEM resolution available at the site (for ray sampling)."""
        u = unit_from_latlon(lat, lon)[None]
        for dem, _ in self.layers:
            if dem.contains_unit(u)[0]:
                return dem.scale_m
        return self.layers[-1][0].scale_m

    def horizon(self, lat, lon, mast_m=2.0, n_az=720, max_km=200.0):
        """Terrain horizon elevation (deg) for azimuths 0..360 (N->E), n_az samples.

        Exact geometry: the elevation of each terrain sample is measured from the
        observer's local horizontal plane, so lunar curvature is built in.
        """
        up, east, north = enu_basis(lat, lon)
        r_obs = R_M + self.site_height(lat, lon) + mast_m
        obs = up * r_obs

        near_step = self.step_m(lat, lon)
        far_step = max(near_step, 240.0)
        d_near = np.arange(near_step, self.near_km * 1000, near_step)
        d_far = np.arange(self.near_km * 1000, max_km * 1000, far_step)
        d = np.concatenate([d_near, d_far])          # metres along the surface
        delta = d / R_M                              # central angle

        az = np.radians(np.arange(n_az) * 360.0 / n_az)
        dirs = np.cos(az)[:, None] * north + np.sin(az)[:, None] * east   # (A,3)
        u = (np.cos(delta)[None, :, None] * up
             + np.sin(delta)[None, :, None] * dirs[:, None, :])           # (A,D,3)
        h = self.height_at_unit(u, dist_km=(d / 1000.0)[None, :])
        pts = u * (R_M + h)[..., None]
        v = pts - obs
        elev = np.degrees(np.arcsin((v @ up) / np.linalg.norm(v, axis=-1)))
        elev = np.where(np.isnan(elev), -90.0, elev)
        return elev.max(axis=1)
