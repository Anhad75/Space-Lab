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

export default function PoleMap({ sites, scenarios, activeKey, onPick }) {
  const [hover, setHover] = useState(null);
  const pos = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
  };
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
          {sites.map((s, k) => {
            const p = toMap(s.lat, s.lon);
            if (!p) return null;
            // drop a label that would collide with an earlier one (pins stay)
            const crowded = sites.slice(0, k).some((o) => {
              const q = toMap(o.lat, o.lon);
              return q && Math.abs(q.fy - p.fy) < 0.025 && Math.abs(q.fx - p.fx) < 0.2;
            });
            return (
              <g key={s.id}>
                <circle cx={p.fx * 100} cy={p.fy * 100} r="1" fill="#0b0d12" stroke="#eceae4" strokeWidth="0.45" />
                {!crowded && <text x={p.fx * 100 + 1.7} y={p.fy * 100 + 0.9} fontSize="2.5" fill="#eceae4" stroke="#0b0d12" strokeWidth="0.5" paintOrder="stroke">{s.name.replace(/ \(.*\)/, "")}</text>}
              </g>
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
        </svg>
      </div>
      <div className="map-readout" style={{ marginTop: 8 }}>
        {hover ? `${fmtLatLon(hover.lat, hover.lon)} · CLICK TO ANALYSE` : "CLICK ANYWHERE FOR A LIVE TERRAIN HORIZON"}
      </div>
    </div>
  );
}
