// Scenario editor (site + landing time, quick date slips) and global settings.
import { useState } from "react";
import { PANELS } from "../lib/geometry.js";
import { fmtLatLon, fromInputValue, toInputValue } from "../lib/format.js";
import PoleMap from "./PoleMap.jsx";

const DAY = 86400e3;
const SLIPS = [-7, -1, 1, 7, 14];

function SiteSelect({ sites, site, onChange }) {
  const groups = [...new Set(sites.map((s) => s.group))];
  const [lat, setLat] = useState(site.custom ? site.lat.toFixed(4) : "-89.0");
  const [lon, setLon] = useState(site.custom ? site.lon.toFixed(4) : "0.0");
  const applyCustom = () => {
    const la = parseFloat(lat), lo = parseFloat(lon);
    if (Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90) onChange(customSite(la, lo));
  };
  return (
    <>
      <label className="field">Site
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
        <div className="row" onClick={(e) => e.stopPropagation()}>
          <label className="field">Lat (°, S &lt; 0)
            <input type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} onBlur={applyCustom} />
          </label>
          <label className="field">Lon (°E)
            <input type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} onBlur={applyCustom} />
          </label>
        </div>
      )}
    </>
  );
}

export function customSite(lat, lon) {
  return { id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`, custom: true, group: "Custom", name: `Custom ${fmtLatLon(lat, lon)}`, lat, lon };
}

export default function Sidebar({ meta, scenarios, activeKey, setActive, updateScenario, addScenario, removeScenario, settings, setSettings, results }) {
  const active = scenarios.find((s) => s.key === activeKey);
  return (
    <aside className="sidebar">
      <section className="panel">
        <div className="panel-head">
          <h2>Scenarios</h2>
          {scenarios.length < 3 && <button className="btn small" onClick={addScenario}>+ Compare</button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scenarios.map((sc, i) => {
            const res = results[sc.key];
            return (
              <div key={sc.key} className="scenario" style={{ "--scn": sc.color }} aria-current={sc.key === activeKey}
                onClick={() => setActive(sc.key)}>
                <div className="scenario-head">
                  <span className="swatch" />
                  <strong>Scenario {String.fromCharCode(65 + i)}</strong>
                  {scenarios.length > 1 && (
                    <button className="icon-btn" aria-label="Remove scenario" onClick={(e) => { e.stopPropagation(); removeScenario(sc.key); }}>×</button>
                  )}
                </div>
                <SiteSelect sites={meta.sites} site={sc.site} onChange={(site) => site && updateScenario(sc.key, { site })} />
                <label className="field" onClick={(e) => e.stopPropagation()}>Landing time (UTC)
                  <input type="datetime-local" value={toInputValue(sc.startMs)}
                    onChange={(e) => { const ms = fromInputValue(e.target.value); if (ms) updateScenario(sc.key, { startMs: ms }); }} />
                </label>
                <div className="slip" onClick={(e) => e.stopPropagation()}>
                  <span className="hint" style={{ alignSelf: "center", marginRight: 2 }}>Slip</span>
                  {SLIPS.map((d) => (
                    <button key={d} className="btn small ghost" onClick={() => updateScenario(sc.key, { startMs: sc.startMs + d * DAY })}>
                      {d > 0 ? `+${d}` : d} d
                    </button>
                  ))}
                </div>
                <div className="slip">
                  {sc.site.approx && !sc.site.optimized && <span className="tag warn">approximate point</span>}
                  {sc.site.optimized && <span className="tag" title={sc.site.note}>AS75 best-lit flat point</span>}
                  {sc.site.slopeDeg != null && <span className={`tag ${sc.site.slopeDeg > 8 ? "warn" : ""}`}>slope {sc.site.slopeDeg}°</span>}
                  {res?.source && <span className="tag">{res.source}</span>}
                  {res?.error && <span className="tag warn">{res.error}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Pick on the map <span className="sub">sets scenario {String.fromCharCode(65 + scenarios.findIndex((s) => s.key === activeKey))}</span></h2>
        <PoleMap sites={meta.sites} scenarios={scenarios} activeKey={activeKey}
          onPick={({ lat, lon }) => active && updateScenario(active.key, { site: customSite(lat, lon) })} />
      </section>

      <section className="panel">
        <h2>Mission assumptions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="field">Mission window
            <select value={settings.durationDays} onChange={(e) => setSettings({ durationDays: +e.target.value })}>
              {[1, 3, 7, 10, 14, 29.5, 60].map((d) => <option key={d} value={d}>{d === 29.5 ? "29.5 days (one lunar day)" : `${d} day${d > 1 ? "s" : ""}`}</option>)}
            </select>
          </label>
          <label className="field">Solar panel / antenna height: <b style={{ color: "var(--text-primary)" }}>{meta.masts[settings.mastIdx]} m</b>
            <input type="range" min="0" max={meta.masts.length - 1} value={settings.mastIdx}
              onChange={(e) => setSettings({ mastIdx: +e.target.value })} />
            <span className="hint">At the pole a taller mast can see over nearby ridges.</span>
          </label>
          <label className="field">Solar panel
            <select value={settings.panel} onChange={(e) => setSettings({ panel: e.target.value })}>
              {Object.entries(PANELS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </label>
          <div className="row">
            <label className="field">Comm margin (°)
              <input type="number" min="0" max="10" step="0.5" value={settings.commMarginDeg}
                onChange={(e) => setSettings({ commMarginDeg: +e.target.value })} />
            </label>
            <label className="field">Battery (h dark)
              <input type="number" min="1" max="400" step="1" value={settings.batteryHours}
                onChange={(e) => setSettings({ batteryHours: +e.target.value })} />
            </label>
          </div>
          <label className="field">A "sunset" means darkness for at least
            <select value={settings.sustainedHours} onChange={(e) => setSettings({ sustainedHours: +e.target.value })}>
              {[1, 3, 6, 12, 24].map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
            <span className="hint">Shorter shadows from jagged terrain still count as "loss of sun".</span>
          </label>
        </div>
      </section>
    </aside>
  );
}
