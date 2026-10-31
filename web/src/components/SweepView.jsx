// "Which day should we land?": every site x every landing day, for the current settings.
import { useEffect, useState } from "react";
import { ensureYears, ephemeris } from "../lib/data.js";
import { fmtDuration, fmtPct, fmtUTC } from "../lib/format.js";
import { maskFor } from "../lib/scenario.js";
import { sweepSite } from "../lib/sweep.js";
import Heatmap, { SWEEP_METRICS } from "./Heatmap.jsx";
import { Stamp } from "./Metrics.jsx";
import { AssumptionsBar } from "./Sidebar.jsx";

const DAY = 86400e3;
const FILTERS = {
  south: { label: "South pole (≥ 80°S)", test: (s) => s.lat <= -80 },
  all: { label: "All curated sites", test: () => true },
};
const RANK = { viable: 0, marginal: 1, poor: 2, relay: 3, fails: 4 };

function Detail({ rows, sel, onOpen }) {
  const row = rows[sel.k], c = row?.cells[sel.d];
  if (!c) return null;
  // the same landing day at every site: "which site rescues this date?"
  const column = rows.map((r) => ({ r, c: r.cells[sel.d] })).filter((x) => x.c)
    .sort((a, b) => RANK[a.c.verdict.kind] - RANK[b.c.verdict.kind] || b.c.score - a.c.score);
  // nearest viable day for the selected site
  let next = null;
  for (let dd = 0; dd < row.cells.length; dd++) {
    for (const d of [sel.d + dd, sel.d - dd]) {
      const x = row.cells[d];
      if (x && x.verdict.kind === "viable") { next = { d, c: x }; break; }
    }
    if (next) break;
  }
  return (
    <div className="detail">
      <div className="detail-main">
        <span className="eyebrow">Selected landing</span>
        <h3 className="serif">{row.label}</h3>
        <div className="mono" style={{ color: "var(--ink-2)", fontSize: 13 }}>Touchdown {fmtUTC(c.startMs)} UTC</div>
        <div style={{ margin: "14px 0" }}><Stamp verdict={c.verdict} reason /></div>
        <dl className="kv">
          <dt>Time sunlit</dt><dd>{fmtPct(c.sunlitPct)}</dd>
          <dt>Longest darkness</dt><dd>{fmtDuration(c.longestDarkH)}</dd>
          <dt>Earth in view</dt><dd>{fmtPct(c.earthPct)}</dd>
          <dt>Longest comm blackout</dt><dd>{fmtDuration(c.longestNoCommH)}</dd>
        </dl>
        {next && next.d !== sel.d && (
          <p className="hint">Nearest viable touchdown here: <b className="mono" style={{ color: "var(--ink)" }}>{fmtUTC(next.c.startMs, false)}</b> ({next.d > sel.d ? "+" : ""}{next.d - sel.d} d)</p>
        )}
        {!next && <p className="hint">No viable touchdown at this site in the whole range.</p>}
        <button className="btn solid" onClick={() => onOpen(row.site, c.startMs)}>Open in Plan →</button>
      </div>
      <div className="detail-col">
        <span className="eyebrow">Same day, every site · {fmtUTC(c.startMs, false)}</span>
        <table className="compare" style={{ marginTop: 8 }}>
          <tbody>
            {column.map(({ r, c: x }) => (
              <tr key={r.site.id} className={r === row ? "sel" : ""}>
                <th>{r.label}</th>
                <td><Stamp verdict={x.verdict} /></td>
                <td className="hint" style={{ whiteSpace: "normal" }}>{x.verdict.reason}</td>
                <td><button className="link-btn" onClick={() => onOpen(r.site, x.startMs)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SweepView({ meta, settings, setSettings, scenarios, onOpen }) {
  const [start, setStart] = useState("2026-11");
  const [months, setMonths] = useState(18);
  const [filter, setFilter] = useState("south");
  const [metric, setMetric] = useState("verdict");
  const [highlight, setHighlight] = useState(false);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState({ k: 0, d: 288 }); // default: Malapert, mid-Aug 2027

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
      if (!cancelled) {
        setRows(out);
        setSel((p) => ({ k: Math.min(p.k, out.length - 1), d: Math.min(p.d, days - 1) }));
        setBusy(false);
      }
    }, 30);
    return () => { cancelled = true; clearTimeout(t); };
  }, [start, months, filter, settings, meta, scenarios]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Date sweep · {settings.durationDays}-day mission</span>
          <h1>Every landing day, every site, at a glance.</h1>
          <p>Each cell is a mission that touches down on that day. A day is <b>viable</b> only if the lander survives every night on its battery and keeps in touch with Earth. Read <b>across</b> a row to see which nearby dates survive a launch slip, or <b>down</b> a column to see which site rescues a fixed date.</p>
        </div>
        <div className="toolbar">
          <label className="field"><span>Colour by</span>
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
      <AssumptionsBar meta={meta} settings={settings} setSettings={setSettings} />
      <section className="section">
        <label className="toggle">
          <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
          <span>Highlight viable days only</span>
        </label>
        {busy && !rows && <div className="loading">Scoring every landing day…</div>}
        {rows && <div style={{ opacity: busy ? 0.45 : 1, transition: "opacity .2s" }}>
          <Heatmap rows={rows} metric={metric} highlightViable={highlight} selected={sel} onSelect={setSel} />
        </div>}
      </section>
      {rows && <section className="section"><Detail rows={rows} sel={sel} onOpen={onOpen} /></section>}
    </div>
  );
}
