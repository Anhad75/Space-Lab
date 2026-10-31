// Turn a scenario (site + landing time) and the global settings into results.
import { metrics, score, siteFrame, timeSeries } from "./geometry.js";
import { ensureYears, ephemeris, loadBrowserDEM, loadSiteMasks } from "./data.js";
import { flatMask } from "./terrain.js";

const DAY = 86400e3;

export function stepMinutesFor(durationDays) {
  if (durationDays <= 3) return 5;
  if (durationDays <= 30) return 10;
  return 30;
}

const customCache = new Map();

/**
 * Horizon mask for a site at a mast height.
 * Curated sites use the pipeline's 40 m masks; custom sites are computed live.
 */
export async function maskFor(site, mastIdx, masts, nAz) {
  if (!site.custom) {
    const all = await loadSiteMasks(site.id);
    return { mask: all.subarray(mastIdx * nAz, (mastIdx + 1) * nAz), heightM: site.heightM, source: "LOLA 40 m + 240 m" };
  }
  const key = `${site.lat.toFixed(5)},${site.lon.toFixed(5)},${masts[mastIdx]}`;
  if (customCache.has(key)) return customCache.get(key);
  let res;
  if (site.lat < -72) {
    const dem = await loadBrowserDEM();
    if (dem.covers(site.lat, site.lon)) {
      const { mask, heightM } = dem.horizon(site.lat, site.lon, masts[mastIdx], nAz);
      res = { mask, heightM, source: "LOLA 240 m (live, in browser)" };
    }
  }
  res ??= { mask: flatMask(masts[mastIdx], nAz), heightM: 0, source: "Smooth sphere (no terrain data here)" };
  customCache.set(key, res);
  return res;
}

export async function computeScenario(scn, settings, meta) {
  const { durationDays, mastIdx, commMarginDeg, panel, sustainedHours, batteryHours } = settings;
  const startMs = scn.startMs;
  const endMs = startMs + durationDays * DAY;
  await ensureYears(startMs, endMs);
  if (!ephemeris.has(startMs)) {
    return { error: "No ephemeris for this date. Available: 1969–1972 and 2023–2032." };
  }
  const { mask, heightM, source } = await maskFor(scn.site, mastIdx, meta.masts, meta.nAz);
  const f = siteFrame(scn.site.lat, scn.site.lon, heightM);
  const ts = timeSeries(ephemeris, f, startMs, endMs, stepMinutesFor(durationDays),
    { mask, commMarginDeg, panel });
  const m = metrics(ts, sustainedHours);
  return { ts, m, score: score(m, { batteryHours }), mask, heightM, source, startMs, endMs };
}

export function verdict(s) {
  if (s >= 70) return { level: "good", label: "Viable" };
  if (s >= 45) return { level: "warning", label: "Marginal" };
  return { level: "critical", label: "Poor" };
}
