// Date-sweep: score every possible landing day for a site in one pass.
import { siteFrame, timeSeries, score } from "./geometry.js";

const DAY = 86400e3;

/**
 * Hourly series over [startMs, startMs + (days + durationDays) days], then for each
 * landing day d the metrics of the mission window [d, d + durationDays].
 * Returns { days: [{ startMs, sunlitPct, earthPct, longestDarkH, score }] }.
 */
export function sweepSite(eph, site, mask, startMs, days, opts) {
  const { durationDays, commMarginDeg, panel, batteryHours } = opts;
  const f = siteFrame(site.lat, site.lon, site.heightM || 0);
  const endMs = startMs + (days + durationDays) * DAY;
  const ts = timeSeries(eph, f, startMs, endMs, 60, { mask, commMarginDeg, panel });
  const n = ts.t.length;
  // prefix sums for O(1) window percentages
  const litP = new Int32Array(n + 1), visP = new Int32Array(n + 1), valP = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    litP[i + 1] = litP[i] + (ts.sunFrac[i] >= 0.5 ? 1 : 0);
    visP[i + 1] = visP[i] + ts.earthVis[i];
    valP[i + 1] = valP[i] + ts.valid[i];
  }
  // darkness run length ending at / starting from each hour
  const darkFwd = new Int32Array(n + 1);
  for (let i = n - 1; i >= 0; i--) darkFwd[i] = ts.valid[i] && ts.sunFrac[i] < 0.5 ? darkFwd[i + 1] + 1 : 0;
  const win = durationDays * 24;
  const out = [];
  for (let d = 0; d < days; d++) {
    const a = d * 24, b = Math.min(n, a + win);
    const valid = valP[b] - valP[a];
    if (valid < (b - a) * 0.9) { out.push(null); continue; }
    let longest = 0;
    for (let i = a; i < b; ) {
      if (darkFwd[i] > 0) {
        const len = Math.min(darkFwd[i], b - i);
        if (len > longest) longest = len;
        i += darkFwd[i];
      } else i++;
    }
    const m = {
      sunlitPct: (100 * (litP[b] - litP[a])) / valid,
      earthPct: (100 * (visP[b] - visP[a])) / valid,
      longestDarkH: longest,
    };
    m.score = score(m, { batteryHours });
    m.startMs = startMs + d * DAY;
    out.push(m);
  }
  return out;
}
