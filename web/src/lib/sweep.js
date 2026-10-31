// Date-sweep: score every possible landing day for a site in one pass.
import { siteFrame, timeSeries, score } from "./geometry.js";
import { assess } from "./verdict.js";

const DAY = 86400e3;

/**
 * Hourly series over [startMs, startMs + (days + durationDays) days], then for each
 * landing day d the metrics of the mission window [d, d + durationDays].
 * Returns per day { startMs, sunlitPct, earthPct, longestDarkH, longestNoCommH, score, verdict }.
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
  // length of the darkness / comm-blackout run starting at each hour
  const darkFwd = new Int32Array(n + 1), blackFwd = new Int32Array(n + 1);
  for (let i = n - 1; i >= 0; i--) {
    darkFwd[i] = ts.valid[i] && ts.sunFrac[i] < 0.5 ? darkFwd[i + 1] + 1 : 0;
    blackFwd[i] = ts.valid[i] && !ts.earthVis[i] ? blackFwd[i + 1] + 1 : 0;
  }
  const longestIn = (fwd, a, b) => {
    let longest = 0;
    for (let i = a; i < b; ) {
      if (fwd[i] > 0) {
        longest = Math.max(longest, Math.min(fwd[i], b - i));
        i += fwd[i];
      } else i++;
    }
    return longest;
  };
  const win = durationDays * 24;
  const out = [];
  for (let d = 0; d < days; d++) {
    const a = d * 24, b = Math.min(n, a + win);
    const valid = valP[b] - valP[a];
    if (valid < (b - a) * 0.9) { out.push(null); continue; }
    const m = {
      sunlitPct: (100 * (litP[b] - litP[a])) / valid,
      earthPct: (100 * (visP[b] - visP[a])) / valid,
      longestDarkH: longestIn(darkFwd, a, b),
      longestNoCommH: longestIn(blackFwd, a, b),
    };
    m.score = score(m, { batteryHours });
    m.verdict = assess(m, m.score, opts);
    m.startMs = startMs + d * DAY;
    out.push(m);
  }
  return out;
}
