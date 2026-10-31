// Date-sweep heatmap: rows = sites, columns = landing day, color = chosen metric.
import { useEffect, useRef, useState } from "react";
import { fmtDuration, fmtPct, fmtUTC } from "../lib/format.js";
import { prepCanvas, useWidth } from "./useSize.js";

// Sequential single hue (blue), stepped dark->light for the dark surface:
// low values recede into the background, high values stand out.
const RAMP = ["#0d366b", "#104281", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb"];

export const SWEEP_METRICS = {
  score: { label: "Viability score", get: (c) => c.score, min: 0, max: 100, fmt: (v) => Math.round(v), higherIsBetter: true },
  sunlitPct: { label: "Time sunlit", get: (c) => c.sunlitPct, min: 0, max: 100, fmt: fmtPct, higherIsBetter: true },
  earthPct: { label: "Earth in view", get: (c) => c.earthPct, min: 0, max: 100, fmt: fmtPct, higherIsBetter: true },
  longestDarkH: { label: "Longest darkness", get: (c) => c.longestDarkH, min: 0, max: 360, fmt: fmtDuration, higherIsBetter: false },
};

const LABEL_W = 170, ROW_H = 26, AXIS_H = 28, PAD_R = 10;

export default function Heatmap({ rows, metric, onPick }) {
  const [ref, width] = useWidth();
  const cv = useRef(null);
  const [tip, setTip] = useState(null);
  const def = SWEEP_METRICS[metric];
  const days = rows[0]?.cells.length || 0;
  const height = AXIS_H + rows.length * ROW_H;
  const plotW = width - LABEL_W - PAD_R;

  const color = (v) => {
    let t = (v - def.min) / (def.max - def.min);
    if (!def.higherIsBetter) t = 1 - t;
    t = Math.min(1, Math.max(0, t));
    return RAMP[Math.round(t * (RAMP.length - 1))];
  };

  useEffect(() => {
    if (!cv.current || !days) return;
    const ctx = prepCanvas(cv.current, width, height);
    ctx.clearRect(0, 0, width, height);
    const cw = plotW / days;
    // month ticks
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "#7f7d76";
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
    rows.forEach((r, k) => {
      const y = AXIS_H + k * ROW_H;
      ctx.fillStyle = "#eceae4";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(r.label.length > 24 ? r.label.slice(0, 23) + "…" : r.label, 0, y + ROW_H / 2);
      r.cells.forEach((c, d) => {
        if (!c) return;
        ctx.fillStyle = color(def.get(c));
        // 2px surface gap between rows; columns are continuous (a day strip)
        ctx.fillRect(LABEL_W + d * cw, y + 1, Math.ceil(cw), ROW_H - 2);
      });
    });
  }, [rows, metric, width, height]);

  const locate = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const d = Math.floor(((x - LABEL_W) / plotW) * days);
    const k = Math.floor((y - AXIS_H) / ROW_H);
    if (d < 0 || d >= days || k < 0 || k >= rows.length) return null;
    const c = rows[k].cells[d];
    return c ? { x, y, row: rows[k], c } : null;
  };

  return (
    <div>
      <div className="chart-wrap" ref={ref}
        onMouseMove={(e) => setTip(locate(e))} onMouseLeave={() => setTip(null)}
        onClick={(e) => { const h = locate(e); if (h) onPick(h.row, h.c.startMs); }}
        style={{ cursor: "pointer" }}>
        <canvas ref={cv} role="img" aria-label={`Heatmap of ${def.label} by site and landing date`} />
        {tip && (
          <>
            <div style={{ position: "absolute", left: tip.x, top: AXIS_H, height: height - AXIS_H, width: 1, background: "#ffffff70", pointerEvents: "none" }} />
            <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
              <b>{tip.row.label}</b> · land {fmtUTC(tip.c.startMs, false)}<br />
              Score <b>{tip.c.score}</b> · sunlit <b>{fmtPct(tip.c.sunlitPct)}</b> · Earth <b>{fmtPct(tip.c.earthPct)}</b><br />
              Longest darkness <b>{fmtDuration(tip.c.longestDarkH)}</b><br />
              <span className="hint">Click to open this scenario</span>
            </div>
          </>
        )}
      </div>
      <div className="legend" style={{ marginTop: 10, alignItems: "center" }}>
        <span>{def.higherIsBetter ? "worse" : "longer (worse)"}</span>
        <span style={{ display: "inline-flex" }}>
          {RAMP.map((c) => <i key={c} style={{ width: 14, height: 10, background: c, borderRadius: 0 }} />)}
        </span>
        <span>{def.higherIsBetter ? "better" : "shorter (better)"}</span>
        <span className="hint">{def.label}: {def.fmt(def.min)} → {def.fmt(def.max)}</span>
      </div>
    </div>
  );
}
