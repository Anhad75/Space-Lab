// 360-degree horizon panorama: terrain silhouette, Sun and Earth tracks, live markers.
import { useEffect, useRef, useState } from "react";
import { horizonAt } from "../lib/geometry.js";
import { fmtDeg } from "../lib/format.js";
import { cssVar, prepCanvas, useWidth } from "./useSize.js";

const PAD = { l: 44, r: 12, t: 14, b: 26 };
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];

function niceStep(range) {
  for (const s of [0.5, 1, 2, 5, 10, 15, 30]) if (range / s <= 8) return s;
  return 30;
}

export default function Panorama({ result, idx, height = 300 }) {
  const [wrapRef, width] = useWidth();
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);
  const geomRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !result) return;
    const { ts, mask } = result;
    const ctx = prepCanvas(cv, width, height);
    const W = width - PAD.l - PAD.r, H = height - PAD.t - PAD.b;
    const n = ts.t.length;

    // vertical range: everything interesting, but keep polar detail visible
    let lo = Math.min(...mask), hi = Math.max(...mask);
    for (let i = 0; i < n; i++) {
      if (!ts.valid[i]) continue;
      if (ts.sunEl[i] > ts.sunHor[i] - 3) { lo = Math.min(lo, ts.sunEl[i]); hi = Math.max(hi, ts.sunEl[i]); }
      if (ts.earthEl[i] > ts.earthHor[i] - 3) { lo = Math.min(lo, ts.earthEl[i]); hi = Math.max(hi, ts.earthEl[i]); }
    }
    lo = Math.max(-12, Math.floor(lo - 1));
    hi = Math.min(90, Math.ceil(hi + 1.5));
    const X = (az) => PAD.l + (az / 360) * W;
    const Y = (el) => PAD.t + (1 - (el - lo) / (hi - lo)) * H;
    const pxPerDegY = H / (hi - lo), pxPerDegX = W / 360;
    geomRef.current = { X, Y, lo, hi, W, exaggeration: pxPerDegY / pxPerDegX };

    // sky
    const sky = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + H);
    sky.addColorStop(0, "#04060a");
    sky.addColorStop(1, "#111727");
    ctx.fillStyle = sky;
    ctx.fillRect(PAD.l, PAD.t, W, H);

    // grid
    ctx.font = "11px Inter, sans-serif";
    ctx.textBaseline = "middle";
    const step = niceStep(hi - lo);
    for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
      ctx.strokeStyle = e === 0 ? "#3b4356" : "#1d2331";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, Y(e) + 0.5); ctx.lineTo(PAD.l + W, Y(e) + 0.5); ctx.stroke();
      ctx.fillStyle = cssVar("--text-muted");
      ctx.textAlign = "right";
      ctx.fillText(`${e}°`, PAD.l - 6, Y(e));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = 0; k <= 8; k++) {
      const x = X(k * 45);
      ctx.strokeStyle = "#1d2331";
      ctx.beginPath(); ctx.moveTo(x + 0.5, PAD.t); ctx.lineTo(x + 0.5, PAD.t + H); ctx.stroke();
      ctx.fillStyle = cssVar("--text-secondary");
      ctx.fillText(COMPASS[k], x, PAD.t + H + 7);
    }

    // terrain silhouette
    ctx.beginPath();
    ctx.moveTo(X(0), PAD.t + H);
    for (let a = 0; a <= mask.length; a++) ctx.lineTo(X((a / mask.length) * 360), Y(mask[a % mask.length]));
    ctx.lineTo(X(360), PAD.t + H);
    ctx.closePath();
    const ground = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + H);
    ground.addColorStop(0, "#4a4f5c");
    ground.addColorStop(1, "#22252d");
    ctx.fillStyle = ground;
    ctx.fill();
    ctx.beginPath();
    for (let a = 0; a <= mask.length; a++) {
      const x = X((a / mask.length) * 360), y = Y(mask[a % mask.length]);
      a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = cssVar("--terrain-edge");
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // tracks: hidden parts dashed and dim, visible parts solid
    const track = (azA, elA, visible, colOn, colOff) => {
      for (const on of [false, true]) {
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < n; i++) {
          if (!ts.valid[i] || visible(i) !== on) { pen = false; continue; }
          const x = X(azA[i]), y = Y(elA[i]);
          if (pen && Math.abs(azA[i] - azA[i - 1]) < 180) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = true;
        }
        ctx.setLineDash(on ? [] : [3, 4]);
        ctx.strokeStyle = on ? colOn : colOff;
        ctx.lineWidth = on ? 2 : 1.5;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.l, PAD.t, W, H); ctx.clip();
    track(ts.sunAz, ts.sunEl, (i) => ts.sunFrac[i] >= 0.5, cssVar("--sun"), cssVar("--sun-dim"));
    track(ts.earthAz, ts.earthEl, (i) => !!ts.earthVis[i], cssVar("--earth"), cssVar("--earth-dim"));

    // live markers
    const i = Math.min(idx, n - 1);
    const marker = (az, el, rDeg, color, label, lit, below = false) => {
      const x = X(az), y = Y(el);
      const r = Math.max(6, rDeg * pxPerDegY);
      if (lit) {
        const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
        g.addColorStop(0, color + "88"); g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = lit ? color : "#00000000";
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
      ctx.font = "600 12px Inter, sans-serif";
      ctx.textAlign = x > PAD.l + W - 120 ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = cssVar("--text-primary");
      const yl = Math.min(Math.max(below ? y + r + 10 : y - r - 10, PAD.t + 8), PAD.t + H - 8);
      ctx.fillText(label, ctx.textAlign === "left" ? x + r + 4 : x - r - 4, yl);
    };
    if (ts.valid[i]) {
      marker(ts.earthAz[i], ts.earthEl[i], 0.95, cssVar("--earth"),
        `Earth ${fmtDeg(ts.earthEl[i], 1)}`, !!ts.earthVis[i], true);
      marker(ts.sunAz[i], ts.sunEl[i], 0.2666, cssVar("--sun"),
        `Sun ${fmtDeg(ts.sunEl[i], 2)}`, ts.sunFrac[i] >= 0.5);
    }
    ctx.restore();

    // off-chart indicators (e.g. Earth far below the horizon on the far side)
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    if (ts.valid[i] && ts.earthEl[i] < lo) {
      ctx.fillStyle = cssVar("--earth");
      ctx.fillText(`▼ Earth ${fmtDeg(ts.earthEl[i], 1)} (below view)`, X(ts.earthAz[i]), PAD.t + H - 4);
    }
    if (ts.valid[i] && ts.sunEl[i] < lo) {
      ctx.fillStyle = cssVar("--sun");
      ctx.fillText(`▼ Sun ${fmtDeg(ts.sunEl[i], 1)}`, X(ts.sunAz[i]), PAD.t + H - 18);
    }
  }, [result, idx, width, height]);

  const onMove = (e) => {
    const g = geomRef.current;
    if (!g || !result) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const az = ((x - PAD.l) / g.W) * 360;
    if (az < 0 || az > 360) return setHover(null);
    setHover({ x, y: e.clientY - rect.top, az, hor: horizonAt(result.mask, az) });
  };

  const exag = geomRef.current?.exaggeration;
  return (
    <div>
      <div className="chart-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvasRef} role="img"
          aria-label="Horizon panorama showing terrain, the Sun's path and Earth's path over the mission window" />
        {hover && (
          <>
            <div style={{ position: "absolute", left: hover.x, top: PAD.t, bottom: PAD.b, width: 1, background: "#ffffff40", pointerEvents: "none" }} />
            <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
              Azimuth <b>{hover.az.toFixed(1)}°</b><br />
              Terrain horizon <b>{fmtDeg(hover.hor, 2)}</b>
            </div>
          </>
        )}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: "var(--sun)" }} />Sun path (visible)</span>
        <span><i style={{ background: "repeating-linear-gradient(90deg,var(--sun-dim) 0 3px,transparent 3px 7px)" }} />Sun hidden by terrain</span>
        <span><i style={{ background: "var(--earth)" }} />Earth path (comms OK)</span>
        <span><i style={{ background: "repeating-linear-gradient(90deg,var(--earth-dim) 0 3px,transparent 3px 7px)" }} />Earth blocked</span>
        <span><i style={{ background: "var(--terrain-edge)" }} />Terrain horizon</span>
        {exag > 1.5 && <span className="hint">Vertical scale exaggerated ×{Math.round(exag)} so the low polar sky is readable</span>}
      </div>
    </div>
  );
}
