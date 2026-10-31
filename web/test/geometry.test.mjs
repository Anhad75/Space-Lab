// Compares web/src/lib/geometry.js against SPICE azlcpo reference values.
// Run: node test/geometry.test.mjs   (from web/)
import { readFileSync } from "node:fs";
import { Ephemeris, siteFrame, skyAt } from "../src/lib/geometry.js";

const dir = new URL("../public/data/ephem/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", dir)));
const eph = new Ephemeris();
for (const [y, info] of Object.entries(index.years)) {
  const buf = readFileSync(new URL(`${y}.bin`, dir));
  eph.add(+y, info.startMs, new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4));
}

const ref = JSON.parse(readFileSync(new URL("reference.json", import.meta.url)));
let worst = 0;
for (const r of ref) {
  const f = siteFrame(r.lat, r.lon, r.heightM);
  const sky = skyAt(eph, f, Date.parse(r.utc.replace(" ", "T")));
  for (const body of ["sun", "earth"]) {
    const [az, el] = r[body];
    const dEl = Math.abs(sky[body].el - el);
    const dAz = Math.abs(((sky[body].az - az + 540) % 360) - 180) * Math.cos((el * Math.PI) / 180);
    worst = Math.max(worst, dEl, dAz);
    if (dEl > 0.01 || dAz > 0.01)
      console.log(`  ${r.site} ${r.utc} ${body}: js az/el ${sky[body].az.toFixed(4)}/${sky[body].el.toFixed(4)} vs spice ${az.toFixed(4)}/${el.toFixed(4)}`);
  }
}
console.log(`${ref.length * 2} comparisons, worst angular difference ${worst.toFixed(5)} deg`);
process.exit(worst < 0.01 ? 0 : 1);
