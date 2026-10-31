// "Which day should we land?": every site x every landing day, for the current settings.
import { useEffect, useState } from "react";
import { ensureYears, ephemeris } from "../lib/data.js";
import { maskFor } from "../lib/scenario.js";
import { sweepSite } from "../lib/sweep.js";
import Heatmap, { SWEEP_METRICS } from "./Heatmap.jsx";

const DAY = 86400e3;
const FILTERS = {
  south: { label: "South pole (≥ 80°S)", test: (s) => s.lat <= -80 },
  all: { label: "All curated sites", test: () => true },
};

export default function SweepView({ meta, settings, scenarios, onOpen }) {
  const [start, setStart] = useState("2026-11");
  const [months, setMonths] = useState(18);
  const [filter, setFilter] = useState("south");
  const [metric, setMetric] = useState("score");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      const startMs = Date.parse(`${start}-01T00:00:00Z`);
      const endDate = new Date(startMs);
      endDate.setUTCMonth(endDate.getUTCMonth() + months);
      const days = Math.round((endDate - startMs) / DAY);
      await ensureYears(startMs, startMs + (days + settings.durationDays) * DAY);
      const sites = meta.sites.filter(FILTERS[filter].test);
      for (const sc of scenarios) if (sc.site.custom && !sites.some((s) => s.id === sc.site.id)) sites.push(sc.site);
      const out = [];
      for (const s of sites) {
        const { mask, heightM } = await maskFor(s, settings.mastIdx, meta.masts, meta.nAz);
        const cells = sweepSite(ephemeris, { ...s, heightM }, mask, startMs, days, settings);
        out.push({ site: s, label: s.name, cells });
        if (cancelled) return;
      }
      if (!cancelled) { setRows(out); setBusy(false); }
    }, 30);
    return () => { cancelled = true; clearTimeout(t); };
  }, [start, months, filter, settings, meta, scenarios]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Date sweep · {settings.durationDays}-day mission · {meta.masts[settings.mastIdx]} m mast · {settings.batteryHours} h battery</span>
          <h1>Every landing day, every site, at a glance.</h1>
          <p>Each cell scores a mission that touches down on that day. Read <b>across</b> a row to see which nearby dates survive a launch slip. Read <b>down</b> a column to see which site rescues a fixed date. Click any cell to open it in Plan.</p>
        </div>
        <div className="toolbar">
          <label className="field"><span>Metric</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {Object.entries(SWEEP_METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </label>
          <label className="field"><span>Sites</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {Object.entries(FILTERS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </select>
          </label>
          <label className="field"><span>From</span>
            <input type="month" value={start} min="2023-01" max="2032-06" onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
          <label className="field"><span>Span</span>
            <select value={months} onChange={(e) => setMonths(+e.target.value)}>
              {[3, 6, 12, 18, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
            </select>
          </label>
        </div>
      </div>
      <section className="section">
        {busy && !rows && <div className="loading">Scoring every landing day…</div>}
        {rows && <div style={{ opacity: busy ? 0.45 : 1, transition: "opacity .2s" }}>
          <Heatmap rows={rows} metric={metric} onPick={(row, ms) => onOpen(row.site, ms)} />
        </div>}
      </section>
    </div>
  );
}
