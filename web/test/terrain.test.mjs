// Browser-DEM horizon (240/480 m) vs the pipeline's 40 m + 240 m masks, 2 m mast.
// The resolutions differ, so we expect agreement in shape, not to the hundredth.
import { readFileSync } from "node:fs";
import { BrowserDEM } from "../src/lib/terrain.js";

const data = new URL("../public/data/", import.meta.url);
const idx = JSON.parse(readFileSync(new URL("dem/index.json", data)));
const dem = new BrowserDEM(idx.layers.map((L) => {
  const b = readFileSync(new URL(`dem/${L.file}`, data));
  return { ...L, data: new Int16Array(b.buffer, b.byteOffset, b.length / 2) };
}));
const sites = JSON.parse(readFileSync(new URL("sites.json", data)));

let fail = 0;
for (const s of sites.sites) {
  if (!dem.covers(s.lat, s.lon) || s.lat > -80) continue;
  const b = readFileSync(new URL(`horizons/${s.id}.bin`, data));
  const all = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  const ref = all.subarray(sites.nAz, 2 * sites.nAz); // mast index 1 = 2 m
  const t0 = performance.now();
  const { mask } = dem.horizon(s.lat, s.lon, 2, sites.nAz);
  const ms = performance.now() - t0;
  let mad = 0;
  for (let i = 0; i < mask.length; i++) mad += Math.abs(mask[i] - ref[i]);
  mad /= mask.length;
  // Custom sites use 240 m terrain: on steep or peaked ground expect ~0.5 deg differences.
  const ok = mad < 0.75;
  fail += !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${s.name.padEnd(26)} mean |diff| ${mad.toFixed(3)} deg  (${ms.toFixed(0)} ms)`);
}
process.exit(fail ? 1 : 0);
