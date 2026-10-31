// Date-sweep heatmap: rows = sites, columns = landing day, colour = verdict or a metric.
import { useEffect, useRef, useState } from "react";
import { fmtDuration, fmtPct, fmtUTC } from "../lib/format.js";
import { LEVELS } from "../lib/verdict.js";
import { prepCanvas, useWidth } from "./useSize.js";

// Sequential single hue (blue), stepped dark->light for the dark surface:
// low values recede into the background, high values stand out.
const RAMP = ["#0d366b", "#104281", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb"];

// Verdict colours are the status palette; the legend pairs each with its label.
export const VERDICT_COLORS = { viable: "#0ca30c", marginal: "#fab219", poor: "#3a3c42", relay: "#ec835a", fails: "#d03b3b" };

export const SWEEP_METRICS = {
  verdict: { label: "Verdict (go / no-go)", categorical: true },
  score: { label: "Weighted score", get: (c) => c.score, min: 0, max: 100, fmt: (v) => Math.round(v), higherIsBetter: true },
  sunlitPct: { label: "Time sunlit", get: (c) => c.sunlitPct, min: 0, max: 100, fmt: fmtPct, higherIsBetter: true },
  earthPct: { label: "Earth in view", get: (c) => c.earthPct, min: 0, max: 100, fmt: fmtPct, higherIsBetter: true },
  longestDarkH: { label: "Longest darkness", get: (c) => c.longestDarkH, min: 0, max: 360, fmt: fmtDuration, higherIsBetter: false },
};

const LABEL_W = 170, ROW_H = 26, AXIS_H = 28, PAD_R = 104, MIN_W = 960;

export default function Heatmap({ rows, metric, highlightViable, selected, onSelect }) {
  const [ref, boxW] = useWidth();
  const width = Math.max(boxW, MIN_W);
  const cv = useRef(null);
  const [tip, setTip] = useState(null);
  const def = SWEEP_METRICS[metric];
  const days = rows[0]?.cells.length || 0;
  const height = AXIS_H + rows.length * ROW_H;
  const plotW = width - LABEL_W - PAD_R;

  const color = (c) => {
    if (def.categorical) return VERDICT_COLORS[c.verdict.kind];
    let t = (def.get(c) - def.min) / (def.max - def.min);
    if (!def.higherIsBetter) t = 1 - t;
    t = Math.min(1, Math.max(0, t));
    return RAMP[Math.round(t * (RAMP.length - 1))];
  };

  useEffect(() => {
    if (!cv.current || !days) return;
    const ctx = prepCanvas(cv.current, width, height);
    ctx.clearRect(0, 0, width, height);
    const cw = plotW / days;
    ctx.font = "10.5px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#6b6a65";
    ctx.textBaseline = "middle";
    const start = rows[0].cells.find(Boolean)?.startMs;
    rows[0].cells.forEach((c, d) => {
      if (!c) return;
      const dt = new Date(c.startMs);
      if (dt.getUTCDate() === 1) {
        const x = LABEL_W + d * cw;
        ctx.fillRect(x, AXIS_H - 6, 1, height - AXIS_H + 6);
        const lbl = dt.toLocaleString("en", { month: "short", timeZone: "UTC" }) + (dt.getUTCMonth() === 0 ? ` ${dt.getUTCFullYear()}` : "");
        ctx.fillText(lbl, x + 3, 12);
      }
    });
    if (!start) return;
    ctx.textAlign = "right";
    ctx.fillText("VIABLE DAYS", width - 4, 12);
    ctx.textAlign = "left";
    rows.forEach((r, k) => {
      const y = AXIS_H + k * ROW_H;
      ctx.fillStyle = "#ecebe5";
      ctx.font = "13px 'IBM Plex Sans', sans-serif";
      ctx.fillText(r.label.length > 24 ? r.label.slice(0, 23) + "…" : r.label, 0, y + ROW_H / 2);
      r.cells.forEach((c, d) => {
        if (!c) return;
        ctx.globalAlpha = highlightViable && c.verdict.kind !== "viable" ? 0.18 : 1;
        ctx.fillStyle = color(c);
        // 2px surface gap between rows; columns are continuous (a day strip)
        ctx.fillRect(LABEL_W + d * cw, y + 1, Math.ceil(cw), ROW_H - 2);
      });
      ctx.globalAlpha = 1;
      const viable = r.cells.filter((c) => c && c.verdict.kind === "viable").length;
      const valid = r.cells.filter(Boolean).length;
      ctx.font = "12px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = viable ? "#ecebe5" : "#6b6a65";
      ctx.fillText(`${viable}`, width - 50, y + ROW_H / 2);
      ctx.fillStyle = "#6b6a65";
      ctx.fillText(`${Math.round((100 * viable) / Math.max(1, valid))}%`, width - 4, y + ROW_H / 2);
      ctx.textAlign = "left";
    });
    // selected cell: column guide + cell outline
    if (selected && selected.d < days) {
      const x = LABEL_W + selected.d * cw;
      ctx.fillStyle = "#ffffff30";
      ctx.fillRect(x, AXIS_H - 4, Math.max(1, cw), height - AXIS_H + 4);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1.5, AXIS_H + selected.k * ROW_H - 0.5, Math.max(3, cw + 3), ROW_H + 1);
    }
  }, [rows, metric, width, height, highlightViable, selected]);

  const locate = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const d = Math.floor(((x - LABEL_W) / plotW) * days);
    const k = Math.floor((y - AXIS_H) / ROW_H);
    if (d < 0 || d >= days || k < 0 || k >= rows.length) return null;
    const c = rows[k].cells[d];
    return c ? { x, y, k, d, row: rows[k], c } : null;
  };

  return (
    <div>
      <div className="hscroll" ref={ref}>
        <div className="chart-wrap" style={{ width, cursor: "pointer" }}
          onMouseMove={(e) => setTip(locate(e))} onMouseLeave={() => setTip(null)}
          onClick={(e) => { const h = locate(e); if (h) onSelect({ k: h.k, d: h.d }); }}>
          <canvas ref={cv} role="img" aria-label={`Heatmap of ${def.label} by site and landing date`} />
          {tip && (
            <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
              <b>{tip.row.label}</b> <span className="t">· touchdown {fmtUTC(tip.c.startMs, false)}</span><br />
              <b style={{ color: VERDICT_COLORS[tip.c.verdict.kind] }}>{tip.c.verdict.label.toUpperCase()}</b> <span className="t">· {tip.c.verdict.reason}</span><br />
              Sunlit <b>{fmtPct(tip.c.sunlitPct)}</b> · Earth <b>{fmtPct(tip.c.earthPct)}</b> · dark <b>{fmtDuration(tip.c.longestDarkH)}</b><br />
              <span className="t">Click for details</span>
            </div>
          )}
        </div>
      </div>
      <div className="legend" style={{ padding: "12px 0 0", alignItems: "center" }}>
        {def.categorical ? (
          Object.entries(LEVELS).map(([k, l]) => (
            <span key={k}><i style={{ width: 12, height: 10, background: VERDICT_COLORS[k] }} />{l.label}</span>
          ))
        ) : (
          <>
            <span>{def.higherIsBetter ? "worse" : "longer (worse)"}</span>
            <span style={{ display: "inline-flex" }}>
              {RAMP.map((c) => <i key={c} style={{ width: 16, height: 8, background: c }} />)}
            </span>
            <span>{def.higherIsBetter ? "better" : "shorter (better)"}</span>
            <span className="mono">{def.label.toUpperCase()} · {def.fmt(def.min)} → {def.fmt(def.max)}</span>
          </>
        )}
      </div>
    </div>
  );
}
