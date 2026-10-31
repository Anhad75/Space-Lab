// Loading of the static data produced by the Python pipeline (web/public/data).
import { Ephemeris } from "./geometry.js";
import { BrowserDEM } from "./terrain.js";

const BASE = `${import.meta.env.BASE_URL}data/`;

async function bin(path, Type) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return new Type(await r.arrayBuffer());
}

async function json(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return r.json();
}

export const ephemeris = new Ephemeris();
let ephemIndex = null;
const yearLoads = {};

/** Make sure ephemeris years covering [startMs, endMs] are loaded. */
export async function ensureYears(startMs, endMs) {
  ephemIndex ??= await json("ephem/index.json");
  const y0 = new Date(startMs).getUTCFullYear();
  const y1 = new Date(endMs).getUTCFullYear();
  const jobs = [];
  for (let y = y0; y <= y1; y++) {
    const info = ephemIndex.years[y];
    if (!info) continue;
    yearLoads[y] ??= bin(`ephem/${y}.bin`, Float32Array).then((d) => ephemeris.add(y, info.startMs, d));
    jobs.push(yearLoads[y]);
  }
  await Promise.all(jobs);
}

export async function availableYears() {
  ephemIndex ??= await json("ephem/index.json");
  return Object.keys(ephemIndex.years).map(Number);
}

export const loadSites = () => json("sites.json");

const maskLoads = {};
/** All precomputed masks of a site: Float32Array[masts.length * nAz]. */
export function loadSiteMasks(id) {
  maskLoads[id] ??= bin(`horizons/${id}.bin`, Float32Array);
  return maskLoads[id];
}

let demLoad = null;
export function loadBrowserDEM() {
  demLoad ??= json("dem/index.json").then(async (idx) => {
    const layers = await Promise.all(idx.layers.map(async (L) => ({
      ...L, data: await bin(`dem/${L.file}`, Int16Array),
    })));
    return new BrowserDEM(layers);
  });
  return demLoad;
}
