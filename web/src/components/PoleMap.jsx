// South-pole relief map (LOLA hillshade, polar stereographic). Click to pick a site.
import { useState } from "react";
import { fmtLatLon } from "../lib/format.js";

const BASE = `${import.meta.env.BASE_URL}data/map/`;
const R_KM = 1737.4;
const HALF_KM = 200; // must match pipeline/build_map.py
const D2R = Math.PI / 180;

/** lat/lon -> fractional map position (0..1, 0..1); null if off the map. */
export function toMap(lat, lon) {
  const la = lat * D2R, lo = lon * D2R;
  const k = (2 * R_KM * Math.cos(la)) / (1 - Math.sin(la));
  const x = k * Math.cos(lo), y = k * Math.sin(lo);
  const fx = (y + HALF_KM) / (2 * HALF_KM), fy = (HALF_KM - x) / (2 * HALF_KM);
  return fx < 0 || fx > 1 || fy < 0 || fy > 1 ? null : { fx, fy };
}

function fromMap(fx, fy) {
  const x = HALF_KM - fy * 2 * HALF_KM, y = fx * 2 * HALF_KM - HALF_KM;
  const rho = Math.hypot(x, y);
  return { lat: (2 * Math.atan(rho / (2 * R_KM)) - Math.PI / 2) / D2R, lon: Math.atan2(y, x) / D2R };
}

const ringR = (lat) => {
  const p = toMap(lat, 0);
  return p ? (0.5 - p.fy) * 100 : null;
};

export default function PoleMap({ sites, scenarios, activeKey, onPick, compact = false }) {
  const [hover, setHover] = useState(null);
  const pos = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
  };
  // Greedy label placement: scenario sites first, then the catalogue; try right,
  // left, above, below; drop a label rather than let it overlap another.
  const fs = compact ? 3.6 : 2.3;
  const labels = [];
  const boxes = [];
  const shortName = (n) => n.replace(/ \(.*\)/, "").replace(" crater floor", "");
  const candidates = [
    ...scenarios.map((sc) => ({ id: `scn-${sc.key}`, site: sc.site, color: sc.color })),
    ...sites.map((s) => ({ id: s.id, site: s })),
  ];
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c.site.id)) continue;
    seen.add(c.site.id);
    const p = toMap(c.site.lat, c.site.lon);
    if (!p) continue;
    const text = c.site.custom ? "Custom" : shortName(c.site.name);
    const w = text.length * fs * 0.6, h = fs * 1.1, x = p.fx * 100, y = p.fy * 100, g = Math.max(fs * 0.7, 3);
    const tries = [
      { anchor: "start", bx: x + g, by: y - h / 2, tx: x + g, ty: y + fs * 0.35 },
      { anchor: "end", bx: x - g - w, by: y - h / 2, tx: x - g, ty: y + fs * 0.35 },
      { anchor: "middle", bx: x - w / 2, by: y - g - h, tx: x, ty: y - g - fs * 0.2 },
      { anchor: "middle", bx: x - w / 2, by: y + g, tx: x, ty: y + g + fs * 0.85 },
    ];
    const fit = tries.find((t) => t.bx >= 1 && t.bx + w <= 99 && t.by >= 6 && t.by + h <= 99
      && !boxes.some((b) => t.bx < b.x + b.w && t.bx + w > b.x && t.by < b.y + b.h && t.by + h > b.y));
    if (!fit) continue;
    boxes.push({ x: fit.bx, y: fit.by, w, h });
    labels.push({ id: c.id, text, x: fit.tx, y: fit.ty, anchor: fit.anchor, color: c.color });
  }

  return (
    <div>
      <div className="map"
        onClick={(e) => { const p = pos(e); onPick(fromMap(p.fx, p.fy)); }}
        onMouseMove={(e) => { const p = pos(e); setHover({ ...p, ...fromMap(p.fx, p.fy) }); }}
        onMouseLeave={() => setHover(null)}>
        <img src={`${BASE}south_hillshade.png`} alt="Shaded relief of the lunar south pole from LOLA altimetry" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {[88, 86, 84].map((lat) => (
            <g key={lat}>
              <circle cx="50" cy="50" r={ringR(lat)} fill="none" stroke="#ffffff38" strokeWidth="0.25" strokeDasharray="1 1" />
              <text x="50.8" y={50 - ringR(lat) + 2.4} fontSize="2.6" fill="#ffffffb0">{lat}°S</text>
            </g>
          ))}
          {[0, 90, 180, 270].map((lon) => {
            const p = toMap(-83.9, lon);
            return <line key={lon} x1="50" y1="50" x2={p ? p.fx * 100 : 50} y2={p ? p.fy * 100 : 50} stroke="#ffffff22" strokeWidth="0.25" />;
          })}
          <text x="50" y="3.5" fontSize="2.8" fill="#ffffffd0" textAnchor="middle">0° · EARTH-FACING</text>
          <text x="97" y="51" fontSize="2.8" fill="#ffffffb0" textAnchor="end">90°E</text>
          <text x="3" y="51" fontSize="2.8" fill="#ffffffb0">90°W</text>
          {sites.map((s) => {
            const p = toMap(s.lat, s.lon);
            if (!p) return null;
            return (
              <circle key={s.id} cx={p.fx * 100} cy={p.fy * 100} r={compact ? 1.3 : 0.9} fill="#0b0d12" stroke="#eceae4" strokeWidth="0.45">
                <title>{s.name}</title>
              </circle>
            );
          })}
          {scenarios.map((sc) => {
            const p = toMap(sc.site.lat, sc.site.lon);
            if (!p) return null;
            return (
              <circle key={sc.key} cx={p.fx * 100} cy={p.fy * 100} r={sc.key === activeKey ? 2.4 : 1.8}
                fill="none" stroke={sc.color} strokeWidth={sc.key === activeKey ? 0.9 : 0.6} />
            );
          })}
          {labels.map((l) => (
            <text key={l.id} x={l.x} y={l.y} fontSize={fs} textAnchor={l.anchor} fill={l.color || "#eceae4"}
              stroke="#08090b" strokeWidth={fs * 0.22} paintOrder="stroke">{l.text}</text>
          ))}
        </svg>
      </div>
      <div className="map-readout" style={{ marginTop: 8 }}>
        {hover ? `${fmtLatLon(hover.lat, hover.lon)} · CLICK TO ANALYSE` : "CLICK ANYWHERE FOR A LIVE TERRAIN HORIZON"}
      </div>
    </div>
  );
}
