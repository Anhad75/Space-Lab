// Gantt-style comparison: per scenario, a sunlight lane and an Earth-visibility lane,
// aligned on mission elapsed time so different landing dates compare directly.
import { useState } from "react";
import { fmtDuration, fmtUTC } from "../lib/format.js";
import { useWidth } from "./useSize.js";

const LANE = 16, GAP = 4, GROUP_GAP = 16, LABEL_W = 150, PAD_R = 12, AXIS_H = 24;

export default function Timeline({ items, durationDays, cursorH, onSeek }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const plotW = width - LABEL_W - PAD_R;
  const totalH = durationDays * 24;
  const X = (h) => LABEL_W + (h / totalH) * plotW;
  const groupH = 2 * LANE + GAP;
  const height = AXIS_H + items.length * (groupH + GROUP_GAP);
  // at least ~48 px between day labels
  const tickEvery = [0.25, 0.5, 1, 2, 5, 7, 10, 14].find((t) => (plotW * t) / durationDays >= 48) ?? 14;

  const ticks = [];
  for (let d = 0; d <= durationDays + 1e-9; d += tickEvery) ticks.push(d);

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const h = ((e.clientX - rect.left - LABEL_W) / plotW) * totalH;
    if (h >= 0 && h <= totalH) onSeek?.(h);
  };

  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={width} height={height} onClick={seek} role="img"
        aria-label="Timeline of sunlight and Earth visibility for each scenario">
        {ticks.map((d) => (
          <g key={d}>
            <line x1={X(d * 24)} x2={X(d * 24)} y1={AXIS_H - 4} y2={height} stroke="#ffffff10" />
            <text x={X(d * 24)} y={12} fill="var(--ink-3)" fontSize="11" textAnchor="middle">
              {d === 0 ? "T0" : `+${d}d`}
            </text>
          </g>
        ))}
        {items.map((it, k) => {
          const y0 = AXIS_H + k * (groupH + GROUP_GAP);
          if (!it.result?.ts) return null;
          const { ts, m } = it.result;
          const hPer = ts.stepMin / 60;
          const lane = (runs, y, color, kind) => runs.map(([a, b], j) => {
            const x0 = X(a * hPer), x1 = X(b * hPer);
            return (
              <rect key={`${kind}${j}`} x={x0 + 1} y={y} width={Math.max(1, x1 - x0 - 2)} height={LANE} rx="1.5" fill={color}
                onMouseMove={(e) => {
                  const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  setTip({ x: e.clientX - r.left, y: e.clientY - r.top, kind, a: ts.t[a], b: ts.t[Math.min(b, ts.t.length - 1)], h: (b - a) * hPer, name: it.label });
                }}
                onMouseLeave={() => setTip(null)} />
            );
          });
          return (
            <g key={it.key}>
              <rect x={0} y={y0} width={3} height={groupH} fill={it.color} />
              <text className="sans" x={12} y={y0 + LANE / 2 + 4} fill="var(--ink)" fontSize="13">
                {it.label.length > 20 ? `${it.label.slice(0, 19)}…` : it.label}
              </text>
              <text x={12} y={y0 + LANE + GAP + LANE / 2 + 4} fill="var(--ink-3)" fontSize="11">
                {fmtUTC(it.result.startMs, false)}
              </text>
              <rect x={LABEL_W} y={y0} width={plotW} height={LANE} fill="#111215" rx="1.5" />
              <rect x={LABEL_W} y={y0 + LANE + GAP} width={plotW} height={LANE} fill="#111215" rx="1.5" />
              {lane(m.sunRuns, y0, "var(--sun)", "Sunlight")}
              {lane(m.earthRuns, y0 + LANE + GAP, "var(--earth)", "Earth in view")}
            </g>
          );
        })}
        {cursorH != null && (
          <line x1={X(cursorH)} x2={X(cursorH)} y1={AXIS_H - 6} y2={height} stroke="var(--sun)" strokeWidth="1.25" />
        )}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.kind.toUpperCase()}</b> <span className="t">· {tip.name}</span><br />
          {fmtUTC(tip.a)} → {fmtUTC(tip.b)} UTC<br />
          Duration <b>{fmtDuration(tip.h)}</b>
        </div>
      )}
      <div className="legend">
        <span><i style={{ background: "var(--sun)", height: 8 }} />Sunlit: at least half the solar disk above terrain</span>
        <span><i style={{ background: "var(--earth)", height: 8 }} />Earth above terrain + comm margin</span>
        <span>Gaps are darkness or comm blackouts · click to move the cursor</span>
      </div>
    </div>
  );
}
