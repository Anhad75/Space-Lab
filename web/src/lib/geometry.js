// Sun/Earth geometry for a lunar surface site, from the precomputed MOON_ME ephemeris.
// Validated against SPICE azlcpo (see test/geometry.test.mjs).

export const MOON_R_KM = 1737.4;
export const SUN_R_KM = 696000;
export const EARTH_R_KM = 6378.1;
export const AU_KM = 149597870.7;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const HOUR_MS = 3600e3;

// ---------- vectors ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);

// ---------- ephemeris ----------
export class Ephemeris {
  // years: { [year]: { startMs, count, data: Float32Array(count*6) } }
  constructor(years = {}) {
    this.years = years;
  }

  add(year, startMs, data) {
    this.years[year] = { startMs, count: data.length / 6, data };
  }

  has(ms) {
    const y = new Date(ms).getUTCFullYear();
    return !!this.years[y];
  }

  /** Interpolated { sun: unit vec, earth: km vec } in MOON_ME at time ms (UTC). */
  sample(ms) {
    const y = this.years[new Date(ms).getUTCFullYear()];
    if (!y) return null;
    const f = (ms - y.startMs) / HOUR_MS;
    const i = Math.min(Math.max(Math.floor(f), 0), y.count - 2);
    const t = f - i;
    const d = y.data;
    const a = i * 6, b = a + 6;
    const sun = [0, 1, 2].map((k) => d[a + k] * (1 - t) + d[b + k] * t);
    const s = norm(sun);
    return {
      sun: [sun[0] / s, sun[1] / s, sun[2] / s],
      earth: [3, 4, 5].map((k) => d[a + k] * (1 - t) + d[b + k] * t),
    };
  }
}

// ---------- site frame ----------
/** Local East/North/Up basis and position (km) for planetocentric lat/lon (deg). */
export function siteFrame(latDeg, lonDeg, heightM = 0) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const r = MOON_R_KM + heightM / 1000;
  return { up, east, north, pos: [up[0] * r, up[1] * r, up[2] * r], lat: latDeg, lon: lonDeg };
}

/** Azimuth (deg, N->E, 0..360) and elevation (deg) of a direction in the site frame. */
export function azel(v, f) {
  const n = norm(v);
  const e = dot(v, f.east), nn = dot(v, f.north), u = dot(v, f.up);
  let az = Math.atan2(e, nn) * R2D;
  if (az < 0) az += 360;
  return { az, el: Math.asin(u / n) * R2D };
}

/** Sun and Earth apparent positions from the site at time ms. */
export function skyAt(eph, f, ms) {
  const s = eph.sample(ms);
  if (!s) return null;
  // Sun: topocentric parallax (~2") is negligible; use direction from Moon centre.
  const sun = azel(s.sun, f);
  // Earth: parallax is ~0.26 deg, so subtract the site position.
  const ev = [s.earth[0] - f.pos[0], s.earth[1] - f.pos[1], s.earth[2] - f.pos[2]];
  const eDist = norm(ev);
  const earth = azel(ev, f);
  earth.distKm = eDist;
  earth.radiusDeg = Math.asin(EARTH_R_KM / eDist) * R2D;
  // Angular separation Sun-Earth (for eclipses of the Sun by the Earth)
  const sepDeg = Math.acos(Math.min(1, Math.max(-1, dot(ev, s.sun) / eDist))) * R2D;
  return { sun, earth, sunRadiusDeg: 0.2666, sepDeg };
}

// ---------- horizon masks ----------
/** Horizon elevation (deg) at azimuth az from a mask of n samples over 0..360. */
export function horizonAt(mask, az) {
  const n = mask.length;
  const f = ((az % 360) + 360) % 360 / 360 * n;
  const i = Math.floor(f) % n;
  const t = f - Math.floor(f);
  return mask[i] * (1 - t) + mask[(i + 1) % n] * t;
}

/** Fraction of a disk of angular radius r whose centre is d deg above a straight horizon. */
export function diskFractionAbove(d, r) {
  if (d >= r) return 1;
  if (d <= -r) return 0;
  const x = d / r;
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}

/** Fraction of disk (radius r1) covered by disk (radius r2) at separation s (all deg). */
export function diskOverlapFraction(r1, r2, s) {
  if (s >= r1 + r2) return 0;
  if (s <= Math.abs(r2 - r1)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
  const a1 = r1 * r1 * Math.acos((s * s + r1 * r1 - r2 * r2) / (2 * s * r1));
  const a2 = r2 * r2 * Math.acos((s * s + r2 * r2 - r1 * r1) / (2 * s * r2));
  const k = 0.5 * Math.sqrt((-s + r1 + r2) * (s + r1 - r2) * (s - r1 + r2) * (s + r1 + r2));
  return (a1 + a2 - k) / (Math.PI * r1 * r1);
}

// ---------- panels ----------
export const PANELS = {
  vertical: { label: "Vertical, sun-tracking", factor: (el) => Math.cos(el * D2R) },
  horizontal: { label: "Horizontal (flat)", factor: (el) => Math.max(0, Math.sin(el * D2R)) },
};

// ---------- time series ----------
/**
 * Evaluate a site over [startMs, endMs] at stepMin resolution.
 * opts: { mask: Float32Array, commMarginDeg, panel }
 * Returns typed arrays, one value per step.
 */
export function timeSeries(eph, f, startMs, endMs, stepMin, opts) {
  const { mask, commMarginDeg = 1, panel = "vertical" } = opts;
  const pf = PANELS[panel].factor;
  const n = Math.max(1, Math.floor((endMs - startMs) / (stepMin * 60e3)) + 1);
  const out = {
    t: new Float64Array(n),
    sunAz: new Float32Array(n), sunEl: new Float32Array(n), sunHor: new Float32Array(n),
    sunFrac: new Float32Array(n), power: new Float32Array(n),
    earthAz: new Float32Array(n), earthEl: new Float32Array(n), earthHor: new Float32Array(n),
    earthVis: new Uint8Array(n), eclipse: new Float32Array(n), valid: new Uint8Array(n),
    stepMin,
  };
  for (let i = 0; i < n; i++) {
    const ms = startMs + i * stepMin * 60e3;
    out.t[i] = ms;
    const sky = skyAt(eph, f, ms);
    if (!sky) continue;
    out.valid[i] = 1;
    const sh = mask ? horizonAt(mask, sky.sun.az) : 0;
    const eh = mask ? horizonAt(mask, sky.earth.az) : 0;
    let frac = diskFractionAbove(sky.sun.el - sh, sky.sunRadiusDeg);
    // Solar eclipse by the Earth (a lunar eclipse seen from the Moon)
    const ecl = frac > 0 ? diskOverlapFraction(sky.sunRadiusDeg, sky.earth.radiusDeg, sky.sepDeg) : 0;
    frac *= 1 - ecl;
    out.sunAz[i] = sky.sun.az; out.sunEl[i] = sky.sun.el; out.sunHor[i] = sh;
    out.sunFrac[i] = frac;
    out.power[i] = frac * pf(sky.sun.el);
    out.eclipse[i] = ecl;
    out.earthAz[i] = sky.earth.az; out.earthEl[i] = sky.earth.el; out.earthHor[i] = eh;
    out.earthVis[i] = sky.earth.el - eh >= commMarginDeg ? 1 : 0;
  }
  return out;
}

// ---------- events & metrics ----------
/** Contiguous [startIdx, endIdx) runs where pred(i) is true. */
export function runs(n, pred) {
  const res = [];
  let s = -1;
  for (let i = 0; i < n; i++) {
    if (pred(i)) { if (s < 0) s = i; }
    else if (s >= 0) { res.push([s, i]); s = -1; }
  }
  if (s >= 0) res.push([s, n]);
  return res;
}

const LIT = 0.5; // a step counts as "sunlit" when at least half the solar disk is visible

/**
 * Operational metrics for a time series.
 * sustainedHours: darkness shorter than this is a "flicker", not a sunset.
 */
export function metrics(ts, sustainedHours = 6) {
  const n = ts.t.length;
  const h = ts.stepMin / 60;
  let lit = 0, vis = 0, both = 0, pow = 0, valid = 0, eclipseSteps = 0;
  for (let i = 0; i < n; i++) {
    if (!ts.valid[i]) continue;
    valid++;
    const l = ts.sunFrac[i] >= LIT;
    lit += l; vis += ts.earthVis[i]; both += l && ts.earthVis[i];
    pow += ts.power[i];
    if (ts.eclipse[i] > 0.01) eclipseSteps++;
  }
  const dark = runs(n, (i) => ts.valid[i] && ts.sunFrac[i] < LIT);
  const noComm = runs(n, (i) => ts.valid[i] && !ts.earthVis[i]);
  const longest = (rs) => rs.reduce((m, [a, b]) => Math.max(m, (b - a) * h), 0);
  const firstIdx = (rs, minH = 0) => {
    const r = rs.find(([a, b]) => (b - a) * h >= minH);
    return r ? r[0] : -1;
  };
  const toMs = (i) => (i < 0 ? null : ts.t[i]);
  const startLit = ts.sunFrac[0] >= LIT;
  return {
    sunlitPct: valid ? (100 * lit) / valid : 0,
    earthPct: valid ? (100 * vis) / valid : 0,
    bothPct: valid ? (100 * both) / valid : 0,
    meanPower: valid ? pow / valid : 0,
    longestDarkH: longest(dark),
    longestNoCommH: longest(noComm),
    eclipseH: eclipseSteps * h,
    sunNow: ts.sunEl[0], sunHorNow: ts.sunHor[0], sunFracNow: ts.sunFrac[0],
    earthNow: ts.earthEl[0], earthHorNow: ts.earthHor[0], earthVisNow: !!ts.earthVis[0],
    // "Next loss of sun": any darkness at all; "next sunset": darkness >= sustainedHours
    nextSunLossMs: startLit ? toMs(firstIdx(dark)) : null,
    nextSunsetMs: startLit ? toMs(firstIdx(dark, sustainedHours)) : null,
    nextSunriseMs: startLit ? null : toMs(firstIdx(runs(n, (i) => ts.sunFrac[i] >= LIT))),
    nextEarthsetMs: ts.earthVis[0] ? toMs(firstIdx(noComm)) : null,
    nextEarthriseMs: ts.earthVis[0] ? null : toMs(firstIdx(runs(n, (i) => ts.earthVis[i]))),
    sunRuns: runs(n, (i) => ts.sunFrac[i] >= LIT),
    earthRuns: runs(n, (i) => ts.earthVis[i]),
  };
}

/**
 * One 0-100 viability score. Weighted toward the things that end missions:
 * long darkness (battery) and long comm blackouts.
 */
export function score(m, { batteryHours = 50 } = {}) {
  const power = Math.min(1, m.sunlitPct / 100);
  const comm = Math.min(1, m.earthPct / 100);
  const survive = m.longestDarkH <= batteryHours ? 1 : Math.max(0, 1 - (m.longestDarkH - batteryHours) / 150);
  return Math.round(100 * (0.4 * power + 0.25 * comm + 0.35 * survive));
}

/**
 * Upcoming events seen from step i of a time series (for the scrubber cursor).
 * Returns ms timestamps (or null if not within the series).
 */
export function upcoming(ts, i, sustainedHours = 6) {
  const n = ts.t.length;
  const stepsSustained = Math.max(1, Math.round((sustainedHours * 60) / ts.stepMin));
  const lit = (k) => ts.sunFrac[k] >= LIT;
  const res = { sunLoss: null, sunset: null, sunrise: null, earthset: null, earthrise: null };
  const litNow = lit(i), visNow = !!ts.earthVis[i];
  for (let k = i + 1; k < n; k++) {
    if (litNow && res.sunLoss == null && !lit(k)) res.sunLoss = ts.t[k];
    if (!litNow && res.sunrise == null && lit(k)) res.sunrise = ts.t[k];
    if (visNow && res.earthset == null && !ts.earthVis[k]) res.earthset = ts.t[k];
    if (!visNow && res.earthrise == null && ts.earthVis[k]) res.earthrise = ts.t[k];
  }
  if (litNow) {
    // first darkness run lasting at least sustainedHours
    let run = 0;
    for (let k = i + 1; k < n; k++) {
      run = lit(k) ? 0 : run + 1;
      if (run >= stepsSustained) { res.sunset = ts.t[k - run + 1]; break; }
    }
  }
  return res;
}
