// Historical check: what does the app's own engine say about real landings?
// Writes public/data/validation/historical.json. Run: node test/historical.mjs (from web/)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Ephemeris, siteFrame, timeSeries, runs } from "../src/lib/geometry.js";

const data = new URL("../public/data/", import.meta.url);
const idx = JSON.parse(readFileSync(new URL("ephem/index.json", data)));
const eph = new Ephemeris();
for (const [y, info] of Object.entries(idx.years)) {
  const b = readFileSync(new URL(`ephem/${y}.bin`, data));
  eph.add(+y, info.startMs, new Float32Array(b.buffer, b.byteOffset, b.length / 4));
}
const meta = JSON.parse(readFileSync(new URL("sites.json", data)));
const DAY = 86400e3;
const iso = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

function analyse(id) {
  const s = meta.sites.find((x) => x.id === id);
  const b = readFileSync(new URL(`horizons/${id}.bin`, data));
  const mask = new Float32Array(b.buffer, b.byteOffset, b.length / 4).subarray(meta.nAz, 2 * meta.nAz); // 2 m
  const land = Date.parse(s.date);
  const ts = timeSeries(eph, siteFrame(s.lat, s.lon, s.heightM), land - 20 * DAY, land + 20 * DAY, 10, { mask, commMarginDeg: 0 });
  const i0 = Math.round((land - ts.t[0]) / 600e3);
  const lit = runs(ts.t.length, (i) => ts.sunFrac[i] >= 0.5);
  const day = lit.find(([a, b]) => a <= i0 && i0 < b) || lit.find(([a]) => a > i0);
  const h = (i) => (ts.t[i] - land) / 3600e3;
  return {
    id, name: s.name, landing: iso(land),
    sunElAtLanding: +ts.sunEl[i0].toFixed(2),
    sunAboveTerrainAtLanding: +(ts.sunEl[i0] - ts.sunHor[i0]).toFixed(2),
    earthElAtLanding: +ts.earthEl[i0].toFixed(2),
    sunrise: day ? iso(ts.t[day[0]]) : null, sunriseHoursBeforeLanding: day ? +(-h(day[0])).toFixed(1) : null,
    sunset: day ? iso(ts.t[day[1]]) : null, sunsetDaysAfterLanding: day ? +(h(day[1]) / 24).toFixed(2) : null,
  };
}

const res = ["ch3", "im1", "im2", "a11", "slim"].map(analyse);
for (const r of res) console.log(JSON.stringify(r));
mkdirSync(new URL("validation/", data), { recursive: true });
writeFileSync(new URL("validation/historical.json", data), JSON.stringify(res, null, 1));
