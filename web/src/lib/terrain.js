// In-browser terrain horizon for custom south-polar sites, from the exported
// LOLA-derived DEM layers (see pipeline/build_horizons.py: export_browser_dem).
import { MOON_R_KM } from "./geometry.js";

const R_M = MOON_R_KM * 1000;
const D2R = Math.PI / 180;

export class BrowserDEM {
  // layers: [{ n, scaleM, center, data: Int16Array }], finest first
  constructor(layers) {
    this.layers = layers;
  }

  /** Height (m above 1737.4 km sphere) at a unit vector, or NaN if not covered. */
  heightUnit(ux, uy, uz) {
    const k = (2 * R_M) / (1 - uz);
    const x = k * ux, y = k * uy;
    for (const L of this.layers) {
      const r = L.center - x / L.scaleM;
      const c = L.center + y / L.scaleM;
      if (r < 0 || c < 0 || r > L.n - 2 || c > L.n - 2) continue;
      const r0 = Math.floor(r), c0 = Math.floor(c);
      const fr = r - r0, fc = c - c0, d = L.data, n = L.n, i = r0 * n + c0;
      return (1 - fr) * (1 - fc) * d[i] + (1 - fr) * fc * d[i + 1]
        + fr * (1 - fc) * d[i + n] + fr * fc * d[i + n + 1];
    }
    return NaN;
  }

  heightLatLon(lat, lon) {
    const la = lat * D2R, lo = lon * D2R;
    return this.heightUnit(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
  }

  covers(lat, lon) {
    return !Number.isNaN(this.heightLatLon(lat, lon));
  }

  /** Same algorithm as pipeline/dem.py Terrain.horizon, at the browser DEM resolution. */
  horizon(lat, lon, mastM = 2, nAz = 720, maxKm = 200) {
    const la = lat * D2R, lo = lon * D2R;
    const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const east = [-Math.sin(lo), Math.cos(lo), 0];
    const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    const hSite = this.heightLatLon(lat, lon);
    const rObs = R_M + (Number.isNaN(hSite) ? 0 : hSite) + mastM;
    const step = this.layers[0].scaleM;
    const mask = new Float32Array(nAz).fill(-90);
    for (let a = 0; a < nAz; a++) {
      const az = (a * 2 * Math.PI) / nAz;
      const dx = Math.cos(az) * north[0] + Math.sin(az) * east[0];
      const dy = Math.cos(az) * north[1] + Math.sin(az) * east[1];
      const dz = Math.cos(az) * north[2] + Math.sin(az) * east[2];
      let best = -90;
      for (let d = step; d < maxKm * 1000; d += d < 25000 ? step : 2 * step) {
        const delta = d / R_M, cd = Math.cos(delta), sd = Math.sin(delta);
        const ux = cd * up[0] + sd * dx, uy = cd * up[1] + sd * dy, uz = cd * up[2] + sd * dz;
        const h = this.heightUnit(ux, uy, uz);
        if (Number.isNaN(h)) break;
        const rp = R_M + h;
        // vector from observer to terrain point, projected on local up
        const vx = ux * rp - up[0] * rObs, vy = uy * rp - up[1] * rObs, vz = uz * rp - up[2] * rObs;
        const vu = vx * up[0] + vy * up[1] + vz * up[2];
        const el = Math.asin(vu / Math.hypot(vx, vy, vz)) / D2R;
        if (el > best) best = el;
      }
      mask[a] = best;
    }
    return { mask, heightM: hSite };
  }
}

/** Horizon of a smooth sphere, for sites without terrain coverage. */
export function flatMask(mastM = 2, nAz = 720) {
  const dip = -Math.acos(R_M / (R_M + mastM)) / D2R;
  return new Float32Array(nAz).fill(dip);
}
