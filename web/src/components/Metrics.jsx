// Metric cards for the active scenario at the cursor time, and the comparison table.
import { upcoming } from "../lib/geometry.js";
import { fmtDeg, fmtDuration, fmtPct, fmtUTC } from "../lib/format.js";
import { verdict } from "../lib/scenario.js";

const ICONS = {
  good: <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.5" fill="currentColor" /><path d="M4 7.2l2 2 4-4.4" stroke="#0b0d12" strokeWidth="1.8" fill="none" /></svg>,
  warning: <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1l6.5 12h-13z" fill="currentColor" /><path d="M7 5.2v3.6M7 10.4v.6" stroke="#0b0d12" strokeWidth="1.6" /></svg>,
  critical: <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" /><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#0b0d12" strokeWidth="1.8" /></svg>,
};

export function Status({ score }) {
  const v = verdict(score);
  return <span className={`status ${v.level}`}>{ICONS[v.level]}{v.label} · {score}</span>;
}

function until(fromMs, toMs) {
  if (toMs == null) return null;
  return (toMs - fromMs) / 3600e3;
}

export function MetricCards({ result, idx, settings }) {
  const { ts, m, score } = result;
  const i = Math.min(idx, ts.t.length - 1);
  const now = ts.t[i];
  const ev = upcoming(ts, i, settings.sustainedHours);
  const lit = ts.sunFrac[i] >= 0.5;
  const vis = !!ts.earthVis[i];
  const winEnd = "beyond this window";
  const sunMargin = ts.sunEl[i] - ts.sunHor[i];
  const earthMargin = ts.earthEl[i] - ts.earthHor[i];

  return (
    <div className="cards">
      <div className="card">
        <span className="k"><span className="dot sun" />Sun now</span>
        <span className="v">{fmtDeg(ts.sunEl[i], 2)}</span>
        <span className="d">
          {lit ? `${fmtDeg(sunMargin, 2)} above terrain` : `${fmtDeg(-sunMargin, 2)} below terrain`}
          {ts.sunFrac[i] > 0 && ts.sunFrac[i] < 1 && ` · ${Math.round(ts.sunFrac[i] * 100)}% of disk visible`}
          {ts.eclipse[i] > 0.01 && " · ECLIPSE by Earth"}
        </span>
      </div>
      <div className="card">
        <span className="k"><span className="dot sun" />{lit ? "Next loss of sun" : "Next sunrise"}</span>
        <span className="v">{lit ? fmtDuration(until(now, ev.sunLoss)) : fmtDuration(until(now, ev.sunrise))}</span>
        <span className="d">
          {lit
            ? (!ev.sunLoss ? "Sun stays up for the rest of this window"
              : ev.sunset ? `Sustained sunset (≥ ${settings.sustainedHours} h dark) in ${fmtDuration(until(now, ev.sunset))}`
              : `Only short terrain shadows: no sustained sunset in this window`)
            : (ev.sunrise ? fmtUTC(ev.sunrise) + " UTC" : `No sunrise ${winEnd}`)}
        </span>
      </div>
      <div className="card">
        <span className="k"><span className="dot earth" />Earth now</span>
        <span className="v">{fmtDeg(ts.earthEl[i], 2)}</span>
        <span className="d">{vis ? `Direct-to-Earth comms OK (${fmtDeg(earthMargin, 2)} clearance)` : "No direct-to-Earth link: relay needed"}</span>
      </div>
      <div className="card">
        <span className="k"><span className="dot earth" />{vis ? "Next Earthset" : "Next Earthrise"}</span>
        <span className="v">{vis ? fmtDuration(until(now, ev.earthset)) : fmtDuration(until(now, ev.earthrise))}</span>
        <span className="d">{vis ? (ev.earthset ? fmtUTC(ev.earthset) + " UTC" : `Earth stays up ${winEnd}`) : (ev.earthrise ? fmtUTC(ev.earthrise) + " UTC" : `Not ${winEnd}`)}</span>
      </div>
      <div className="card">
        <span className="k">Mission window verdict</span>
        <span className="v" style={{ fontSize: 18, paddingTop: 4 }}><Status score={score} /></span>
        <span className="d">Sunlit {fmtPct(m.sunlitPct)} · Earth {fmtPct(m.earthPct)} · longest dark {fmtDuration(m.longestDarkH)}</span>
      </div>
    </div>
  );
}

const ROWS = [
  { k: "score", label: "Viability score", fmt: (v) => v, better: "high", get: (r) => r.score },
  { k: "sunlit", label: "Time sunlit", fmt: fmtPct, better: "high", get: (r) => r.m.sunlitPct },
  { k: "power", label: "Mean power (% of panel rating)", fmt: (v) => fmtPct(v * 100), better: "high", get: (r) => r.m.meanPower },
  { k: "dark", label: "Longest darkness (battery)", fmt: fmtDuration, better: "low", get: (r) => r.m.longestDarkH },
  { k: "earth", label: "Earth in view", fmt: fmtPct, better: "high", get: (r) => r.m.earthPct },
  { k: "nocomm", label: "Longest comm blackout", fmt: fmtDuration, better: "low", get: (r) => r.m.longestNoCommH },
  { k: "both", label: "Sun + Earth together", fmt: fmtPct, better: "high", get: (r) => r.m.bothPct },
  { k: "eclipse", label: "Eclipse by Earth", fmt: (v) => (v > 0 ? fmtDuration(v) : "none"), better: "low", get: (r) => r.m.eclipseH },
  { k: "elev", label: "Terrain height", fmt: (v) => `${Math.round(v)} m`, get: (r) => r.heightM },
  { k: "slope", label: "Local slope (40 m)", fmt: (v) => (v == null ? "—" : `${v}°`), get: (r, it) => it.site.slopeDeg },
];

export function CompareTable({ items }) {
  const ok = items.filter((it) => it.result?.m);
  if (ok.length === 0) return null;
  return (
    <div className="table-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th />
            {ok.map((it) => (
              <th key={it.key}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="swatch" style={{ "--scn": it.color }} />{it.label}
                </span>
                <div className="hint">{fmtUTC(it.result.startMs)} UTC</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const vals = ok.map((it) => row.get(it.result, it));
            let best = -1;
            if (row.better && ok.length > 1) {
              const pick = row.better === "high" ? Math.max(...vals) : Math.min(...vals);
              if (vals.filter((v) => v === pick).length === 1) best = vals.indexOf(pick);
            }
            return (
              <tr key={row.k}>
                <th>{row.label}</th>
                {vals.map((v, j) => (
                  <td key={j} className={j === best ? "best" : ""}>
                    {row.k === "score" ? <Status score={v} /> : row.fmt(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
