// Control column: edit the active scenario (site, landing time, date slips, replays,
// map pick), plus the mission-assumptions bar shared by all scenarios.
import { useEffect, useState } from "react";
import { PANELS } from "../lib/geometry.js";
import { fmtLatLon, fmtUTC } from "../lib/format.js";
import PoleMap from "./PoleMap.jsx";

const DAY = 86400e3;
const SLIPS = [-7, -1, 1, 7, 14];

export function customSite(lat, lon) {
  return { id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`, custom: true, group: "Custom", name: `Custom ${fmtLatLon(lat, lon)}`, lat, lon };
}

function SiteSelect({ sites, site, onChange }) {
  const groups = [...new Set(sites.map((s) => s.group))];
  const [lat, setLat] = useState("-89.0");
  const [lon, setLon] = useState("0.0");
  useEffect(() => {
    if (site.custom) { setLat(site.lat.toFixed(4)); setLon(site.lon.toFixed(4)); }
  }, [site]);
  const applyCustom = () => {
    const la = parseFloat(lat), lo = parseFloat(lon);
    if (Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90) onChange(customSite(la, lo));
  };
  return (
    <>
      <label className="field"><span>Landing site</span>
        <select value={site.custom ? "__custom" : site.id}
          onChange={(e) => (e.target.value === "__custom"
            ? onChange(customSite(parseFloat(lat), parseFloat(lon)))
            : onChange(sites.find((s) => s.id === e.target.value)))}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {sites.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          ))}
          <option value="__custom">Custom coordinates…</option>
        </select>
      </label>
      {site.custom && (
        <div className="row">
          <label className="field"><span>Lat °</span>
            <input type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} onBlur={applyCustom} />
          </label>
          <label className="field"><span>Lon °E</span>
            <input type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} onBlur={applyCustom} />
          </label>
        </div>
      )}
    </>
  );
}

/** ISO "YYYY-MM-DD HH:MM" UTC entry; applies on Enter or blur, reverts if invalid. */
function UtcInput({ ms, onChange }) {
  const [text, setText] = useState(fmtUTC(ms));
  useEffect(() => setText(fmtUTC(ms)), [ms]);
  const apply = () => {
    const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    const v = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
    if (Number.isFinite(v)) onChange(v); else setText(fmtUTC(ms));
  };
  return (
    <input type="text" className="mono" value={text} spellCheck="false" inputMode="numeric"
      onChange={(e) => setText(e.target.value)} onBlur={apply}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
  );
}

// One-click historical replays: site + real touchdown time + a fitting window.
const REPLAYS = [
  { id: "im1", label: "IM-1 Odysseus", days: 7 },
  { id: "im2", label: "IM-2 Athena", days: 3 },
  { id: "ch3", label: "Chandrayaan-3", days: 14 },
  { id: "a11", label: "Apollo 11", days: 1 },
];

export default function Controls({ meta, scenario, letter, scenarios, activeKey, updateScenario, result, onReplay }) {
  const sc = scenario;
  const set = (patch) => updateScenario(sc.key, patch);
  const [bigMap, setBigMap] = useState(false);
  const pick = ({ lat, lon }) => { set({ site: customSite(lat, lon) }); setBigMap(false); };
  return (
    <aside className="controls">
      <div className="ctl">
        <div className="ctl-head">
          <span className="eyebrow" style={{ color: sc.color }}>Editing scenario {letter}</span>
        </div>
        <SiteSelect sites={meta.sites} site={sc.site} onChange={(site) => site && set({ site })} />
        <label className="field"><span>Touchdown · UTC · YYYY-MM-DD HH:MM</span>
          <UtcInput ms={sc.startMs} onChange={(startMs) => set({ startMs })} />
        </label>
        <div className="field">
          <span>Schedule slip</span>
          <div className="seg">
            {SLIPS.map((d) => (
              <button key={d} onClick={() => set({ startMs: sc.startMs + d * DAY })}>{d > 0 ? `+${d}` : `−${-d}`}d</button>
            ))}
          </div>
        </div>
        <div className="chips">
          {sc.site.optimized && <span className="chip" title={sc.site.note}>Best-lit flat point · approx. region</span>}
          {sc.site.approx && !sc.site.optimized && <span className="chip warn">Approximate point</span>}
          {sc.site.slopeDeg != null && <span className={`chip ${sc.site.slopeDeg > 8 ? "warn" : ""}`}>Slope {sc.site.slopeDeg}°{sc.site.slopeDeg > 8 ? " · steep" : ""}</span>}
          {result?.source && <span className="chip">{result.source}</span>}
          {result?.error && <span className="chip warn">{result.error}</span>}
        </div>
      </div>

      <div className="ctl">
        <span className="eyebrow">Replay a real landing</span>
        <div className="replays">
          {REPLAYS.map((r) => {
            const site = meta.sites.find((s) => s.id === r.id);
            if (!site?.date) return null;
            return (
              <button key={r.id} className="replay" onClick={() => onReplay(site, Date.parse(site.date), r.days)}>
                <span>{r.label}</span>
                <span className="mono">{site.date.slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ctl">
        <div className="ctl-head">
          <span className="eyebrow">South polar map · LOLA</span>
          <button className="link-btn" onClick={() => setBigMap(true)}>Expand ⤢</button>
        </div>
        <PoleMap sites={meta.sites} scenarios={scenarios} activeKey={activeKey} onPick={pick} compact />
      </div>

      {bigMap && (
        <div className="modal" role="dialog" aria-label="South polar map" onClick={() => setBigMap(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="ctl-head" style={{ marginBottom: 10 }}>
              <span className="eyebrow">Click a spot to analyse it as scenario {letter} · live terrain horizon</span>
              <button className="link-btn" onClick={() => setBigMap(false)}>Close ×</button>
            </div>
            <PoleMap sites={meta.sites} scenarios={scenarios} activeKey={activeKey} onPick={pick} />
          </div>
        </div>
      )}
    </aside>
  );
}

/** Mission assumptions shared by every scenario, as one compact bar. */
export function AssumptionsBar({ meta, settings, setSettings }) {
  return (
    <div className="assume">
      <label className="field"><span>Window</span>
        <select value={settings.durationDays} onChange={(e) => setSettings({ durationDays: +e.target.value })}>
          {[1, 3, 7, 10, 14, 29.5, 60].map((d) => <option key={d} value={d}>{d === 29.5 ? "29.5 d · lunar day" : `${d} day${d > 1 ? "s" : ""}`}</option>)}
        </select>
      </label>
      <label className="field"><span>Battery survives</span>
        <span className="unit-input"><input type="number" min="1" max="400" step="1" value={settings.batteryHours}
          onChange={(e) => setSettings({ batteryHours: +e.target.value || 1 })} /><i>h dark</i></span>
      </label>
      <label className="field"><span>Max comm blackout</span>
        <span className="unit-input"><input type="number" min="1" max="720" step="1" value={settings.maxBlackoutHours}
          onChange={(e) => setSettings({ maxBlackoutHours: +e.target.value || 1 })} /><i>h</i></span>
      </label>
      <label className="field"><span>Mast · <span className="val">{meta.masts[settings.mastIdx]} m</span></span>
        <input type="range" min="0" max={meta.masts.length - 1} value={settings.mastIdx}
          onChange={(e) => setSettings({ mastIdx: +e.target.value })} />
      </label>
      <label className="field"><span>Solar array</span>
        <select value={settings.panel} onChange={(e) => setSettings({ panel: e.target.value })}>
          {Object.entries(PANELS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </label>
      <label className="field"><span>Comm margin</span>
        <span className="unit-input"><input type="number" min="0" max="10" step="0.5" value={settings.commMarginDeg}
          onChange={(e) => setSettings({ commMarginDeg: +e.target.value })} /><i>°</i></span>
      </label>
      <label className="field" title="Shorter shadows from jagged terrain still count as a loss of sun"><span>Sunset = dark ≥</span>
        <select value={settings.sustainedHours} onChange={(e) => setSettings({ sustainedHours: +e.target.value })}>
          {[1, 3, 6, 12, 24].map((h) => <option key={h} value={h}>{h} h</option>)}
        </select>
      </label>
    </div>
  );
}
