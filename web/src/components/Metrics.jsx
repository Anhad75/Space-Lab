// Telemetry readouts for the active scenario at the cursor time, and the comparison table.
import { upcoming } from "../lib/geometry.js";
import { fmtDuration, fmtPct, fmtUTC } from "../lib/format.js";
import { verdict } from "../lib/scenario.js";

const ICONS = {
  good: <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.3l2.6 2.6L10 3.4" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>,
  warning: <svg width="11" height="11" viewBox="0 0 12 12"><path d="M6 1.2l5 9.6H1z" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M6 4.8v2.6M6 8.6v.8" stroke="currentColor" strokeWidth="1.4" /></svg>,
  critical: <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.8" /></svg>,
};

export function Stamp({ score }) {
  const v = verdict(score);
  return <span className={`stamp ${v.level}`}>{ICONS[v.level]}{v.label}<b>{score}</b></span>;
}

const until = (from, to) => (to == null ? null : (to - from) / 3600e3);

/** "4.18°" with the unit set smaller. */
function Deg({ v, d = 2 }) {
  if (v == null || !isFinite(v)) return <>—</>;
  return <>{v.toFixed(d)}<small className="deg">°</small></>;
}

/** Duration in big type: "4 d 22 h" -> numbers big, units small. */
function Dur({ h }) {
  if (h == null) return <>—</>;
  const parts = fmtDuration(h).split(" ");
  return <>{parts.map((p, i) => (i % 2 ? <small key={i}>{p} </small> : <span key={i}>{p}</span>))}</>;
}

export function Readouts({ result, idx, settings }) {
  const { ts, m, score } = result;
  const i = Math.min(idx, ts.t.length - 1);
  const now = ts.t[i];
  const ev = upcoming(ts, i, settings.sustainedHours);
  const lit = ts.sunFrac[i] >= 0.5;
  const vis = !!ts.earthVis[i];
  const sunMargin = ts.sunEl[i] - ts.sunHor[i];
  const earthMargin = ts.earthEl[i] - ts.earthHor[i];

  return (
    <div className="readouts">
      <div className="readout">
        <span className="lbl"><span className={`pip ${lit ? "sun" : "off"}`} /><span className="eyebrow">Sun elevation</span></span>
        <span className="big"><Deg v={ts.sunEl[i]} /></span>
        <span className="sub">
          {lit ? <>{sunMargin.toFixed(2)}° clear of terrain</> : <>Hidden {(-sunMargin).toFixed(2)}° below terrain</>}
          {ts.sunFrac[i] > 0 && ts.sunFrac[i] < 1 && <> · {Math.round(ts.sunFrac[i] * 100)}% of disk</>}
          {ts.eclipse[i] > 0.01 && <> · <b style={{ color: "var(--sun)" }}>eclipsed by Earth</b></>}
        </span>
      </div>
      <div className="readout">
        <span className="lbl"><span className="pip sun" /><span className="eyebrow">{lit ? "Next loss of sun" : "Next sunrise"}</span></span>
        <span className="big">{lit ? (ev.sunLoss ? <Dur h={until(now, ev.sunLoss)} /> : "—") : (ev.sunrise ? <Dur h={until(now, ev.sunrise)} /> : "—")}</span>
        <span className="sub">
          {lit
            ? (!ev.sunLoss ? "Sun stays up for the rest of the window"
              : ev.sunset ? <>Sustained sunset in {fmtDuration(until(now, ev.sunset))}</>
              : "Brief terrain shadows only, no sustained sunset")
            : (ev.sunrise ? `${fmtUTC(ev.sunrise)} UTC` : "Not within this window")}
        </span>
      </div>
      <div className="readout">
        <span className="lbl"><span className={`pip ${vis ? "earth" : "off"}`} /><span className="eyebrow">Earth elevation</span></span>
        <span className="big"><Deg v={ts.earthEl[i]} /></span>
        <span className="sub">{vis ? <>Direct link open · {earthMargin.toFixed(2)}° clearance</> : "No direct link: relay required"}</span>
      </div>
      <div className="readout">
        <span className="lbl"><span className="pip earth" /><span className="eyebrow">{vis ? "Next Earthset" : "Next Earthrise"}</span></span>
        <span className="big">{vis ? (ev.earthset ? <Dur h={until(now, ev.earthset)} /> : "—") : (ev.earthrise ? <Dur h={until(now, ev.earthrise)} /> : "—")}</span>
        <span className="sub">{vis ? (ev.earthset ? `${fmtUTC(ev.earthset)} UTC` : "Earth stays up for the rest of the window") : (ev.earthrise ? `${fmtUTC(ev.earthrise)} UTC` : "Not within this window")}</span>
      </div>
      <div className="readout">
        <span className="lbl"><span className="eyebrow">Window verdict</span></span>
        <span style={{ paddingTop: 4 }}><Stamp score={score} /></span>
        <span className="sub">Sunlit {fmtPct(m.sunlitPct)} · Earth {fmtPct(m.earthPct)}<br />Longest dark {fmtDuration(m.longestDarkH)}</span>
      </div>
    </div>
  );
}

const ROWS = [
  { k: "score", label: "Viability score", fmt: (v) => v, better: "high", get: (r) => r.score },
  { k: "sunlit", label: "Time sunlit", fmt: fmtPct, better: "high", get: (r) => r.m.sunlitPct },
  { k: "power", label: "Mean power, % of rating", fmt: (v) => fmtPct(v * 100), better: "high", get: (r) => r.m.meanPower },
  { k: "dark", label: "Longest darkness", fmt: fmtDuration, better: "low", get: (r) => r.m.longestDarkH },
  { k: "earth", label: "Earth in view", fmt: fmtPct, better: "high", get: (r) => r.m.earthPct },
  { k: "nocomm", label: "Longest comm blackout", fmt: fmtDuration, better: "low", get: (r) => r.m.longestNoCommH },
  { k: "both", label: "Sun and Earth together", fmt: fmtPct, better: "high", get: (r) => r.m.bothPct },
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
              <th key={it.key} style={{ boxShadow: `inset 0 2px 0 ${it.color}` }}>
                <div className="scn-name">{it.label}</div>
                <div className="hint mono">{fmtUTC(it.result.startMs)} UTC</div>
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
                  <td key={j} className={j === best && row.k !== "score" ? "best" : ""}>
                    {row.k === "score" ? <Stamp score={v} /> : row.fmt(v)}
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
