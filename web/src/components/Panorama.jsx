// 360-degree horizon panorama: terrain silhouette, Sun and Earth tracks, live markers.
import { useEffect, useMemo, useRef, useState } from "react";
import { horizonAt } from "../lib/geometry.js";
import { fmtDeg } from "../lib/format.js";
import { cssVar, prepCanvas, useWidth } from "./useSize.js";

const PAD = { l: 0, r: 0, t: 0, b: 34 };
const CARDINAL = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW", 360: "N" };

function niceStep(range) {
  for (const s of [0.5, 1, 2, 5, 10, 15, 30]) if (range / s <= 7) return s;
  return 30;
}

// Deterministic star field (seeded), positions in 0..1
function makeStars(n) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), r: rnd() ** 3 * 1.3 + 0.3, a: 0.25 + rnd() * 0.6 }));
}

export default function Panorama({ result, idx, height = 330 }) {
  const [wrapRef, width] = useWidth();
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);
  const geomRef = useRef(null);
  const stars = useMemo(() => makeStars(260), []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !result) return;
    const { ts, mask } = result;
    const ctx = prepCanvas(cv, width, height);
    const W = width - PAD.l - PAD.r, H = height - PAD.t - PAD.b;
    const n = ts.t.length;
    const sun = cssVar("--sun"), earth = cssVar("--earth");

    // vertical range: everything interesting, but keep polar detail visible
    let lo = Math.min(...mask), hi = Math.max(...mask);
    for (let i = 0; i < n; i++) {
      if (!ts.valid[i]) continue;
      if (ts.sunEl[i] > ts.sunHor[i] - 3) { lo = Math.min(lo, ts.sunEl[i]); hi = Math.max(hi, ts.sunEl[i]); }
      if (ts.earthEl[i] > ts.earthHor[i] - 3) { lo = Math.min(lo, ts.earthEl[i]); hi = Math.max(hi, ts.earthEl[i]); }
    }
    lo = Math.max(-12, Math.floor(lo - 1));
    hi = Math.min(90, Math.ceil(hi + 2));
    const X = (az) => PAD.l + (az / 360) * W;
    const Y = (el) => PAD.t + (1 - (el - lo) / (hi - lo)) * H;
    const pxPerDegY = H / (hi - lo), pxPerDegX = W / 360;
    geomRef.current = { X, Y, lo, hi, W, H, exaggeration: pxPerDegY / pxPerDegX };

    // sky + stars
    const sky = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + H);
    sky.addColorStop(0, "#020304");
    sky.addColorStop(1, "#0b0e16");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, PAD.t + H);
    for (const st of stars) {
      ctx.globalAlpha = st.a;
      ctx.fillStyle = "#dfe6f5";
      ctx.beginPath(); ctx.arc(st.x * width, st.y * H, st.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // elevation grid: faint dotted lines, labels on the right edge
    ctx.font = "10.5px 'IBM Plex Mono', monospace";
    const step = niceStep(hi - lo);
    for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
      ctx.strokeStyle = e === 0 ? "#ffffff38" : "#ffffff12";
      ctx.setLineDash(e === 0 ? [] : [1, 4]);
      ctx.beginPath(); ctx.moveTo(0, Y(e) + 0.5); ctx.lineTo(width, Y(e) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff66";
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText(`${e > 0 ? "+" : ""}${e}°`, width - 8, Y(e) - 3);
    }
    if (lo < 0 && hi > 0 && width > 700) {
      ctx.fillStyle = "#ffffff55"; ctx.textAlign = "left";
      ctx.fillText("0° · ASTRONOMICAL HORIZON", 10, Y(0) - 3);
    }

    // tracks (drawn before terrain for the hidden part, after for the visible part)
    const track = (azA, elA, visible, col, on) => {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        if (!ts.valid[i] || visible(i) !== on) { pen = false; continue; }
        const x = X(azA[i]), y = Y(elA[i]);
        if (pen && Math.abs(azA[i] - azA[i - 1]) < 180) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.setLineDash(on ? [] : [2, 4]);
      ctx.strokeStyle = col;
      ctx.lineWidth = on ? 2 : 1.25;
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const sunVis = (i) => ts.sunFrac[i] >= 0.5;
    const earthVis = (i) => !!ts.earthVis[i];

    // terrain silhouette
    const ridge = () => {
      ctx.beginPath();
      for (let a = 0; a <= mask.length; a++) {
        const x = X((a / mask.length) * 360), y = Y(mask[a % mask.length]);
        a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    };
    ridge();
    ctx.lineTo(X(360), PAD.t + H); ctx.lineTo(X(0), PAD.t + H); ctx.closePath();
    const ground = ctx.createLinearGradient(0, Y(hi * 0.6), 0, PAD.t + H);
    ground.addColorStop(0, "#3c3d42");
    ground.addColorStop(0.35, "#202125");
    ground.addColorStop(1, "#0c0d0f");
    ctx.fillStyle = ground;
    ctx.fill();
    track(ts.sunAz, ts.sunEl, sunVis, cssVar("--sun-dim"), false);
    track(ts.earthAz, ts.earthEl, earthVis, cssVar("--earth-dim"), false);
    ridge();
    ctx.strokeStyle = cssVar("--terrain-edge");
    ctx.lineWidth = 1.25;
    ctx.stroke();
    track(ts.sunAz, ts.sunEl, sunVis, sun, true);
    track(ts.earthAz, ts.earthEl, earthVis, earth, true);

    // compass tape
    const tapeY = PAD.t + H;
    ctx.fillStyle = "#050607";
    ctx.fillRect(0, tapeY, width, PAD.b);
    ctx.strokeStyle = "#ffffff30";
    ctx.beginPath(); ctx.moveTo(0, tapeY + 0.5); ctx.lineTo(width, tapeY + 0.5); ctx.stroke();
    ctx.textBaseline = "top"; ctx.textAlign = "center";
    for (let a = 0; a <= 360; a += 5) {
      const x = Math.round(X(a)) + 0.5;
      const major = a % 45 === 0, mid = a % 15 === 0;
      ctx.strokeStyle = major ? "#ffffffaa" : "#ffffff40";
      ctx.beginPath(); ctx.moveTo(x, tapeY); ctx.lineTo(x, tapeY + (major ? 9 : mid ? 6 : 3)); ctx.stroke();
      if (major && pxPerDegX * 45 > 34) {
        ctx.font = "600 11px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "#ecebe5";
        ctx.fillText(CARDINAL[a], Math.min(Math.max(x, 8), width - 8), tapeY + 13);
      } else if (mid && pxPerDegX * 15 > 34) {
        ctx.font = "10px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "#ffffff55";
        ctx.fillText(String(a), x, tapeY + 14);
      }
    }

    // live markers
    const i = Math.min(idx, n - 1);
    const marker = (az, el, rDeg, color, label_, lit, below) => {
      const y = Y(el);
      const r = Math.max(5.5, rDeg * pxPerDegY);
      // near 0/360 the disk wraps: draw its twin on the other edge too
      const twin = az < 8 ? az + 360 : az > 352 ? az - 360 : null;
      if (twin != null) disk(X(twin), y, r, color, lit);
      const x = X(az);
      disk(x, y, r, color, lit);
      label(x, y, r, color, label_, below);
    };
    const disk = (x, y, r, color, lit) => {
      if (lit) {
        const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 5);
        g.addColorStop(0, color + "70"); g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 1.5; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r + (lit ? 3 : 0), 0, Math.PI * 2); ctx.stroke();
    };
    const label = (x, y, r, color, text, below) => {
      // leader + label
      const ly = Math.min(Math.max(below ? y + r + 22 : y - r - 22, 14), H - 10);
      ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, below ? y + r + 4 : y - r - 4); ctx.lineTo(x, below ? ly - 8 : ly + 6); ctx.stroke();
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.textAlign = x > width - 110 ? "right" : x < 110 ? "left" : "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(text).width;
      const tx = ctx.textAlign === "center" ? x - tw / 2 : ctx.textAlign === "left" ? x : x - tw;
      ctx.fillStyle = "#050607d0";
      ctx.fillRect(tx - 5, ly - 9, tw + 10, 18);
      ctx.fillStyle = color;
      ctx.fillText(text, x, ly);
    };
    if (ts.valid[i]) {
      marker(ts.earthAz[i], ts.earthEl[i], 0.95, earth, `EARTH ${fmtDeg(ts.earthEl[i], 2)}`, !!ts.earthVis[i], true);
      marker(ts.sunAz[i], ts.sunEl[i], 0.2666, sun, `SUN ${fmtDeg(ts.sunEl[i], 2)}`, ts.sunFrac[i] >= 0.5, false);
    }

    // off-chart indicators (e.g. Earth far below the horizon on the far side)
    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    if (ts.valid[i] && ts.earthEl[i] < lo) {
      ctx.fillStyle = earth;
      ctx.fillText(`▼ EARTH ${fmtDeg(ts.earthEl[i], 1)} · BELOW VIEW`, X(ts.earthAz[i]), H - 6);
    }
    if (ts.valid[i] && ts.sunEl[i] < lo) {
      ctx.fillStyle = sun;
      ctx.fillText(`▼ SUN ${fmtDeg(ts.sunEl[i], 1)}`, X(ts.sunAz[i]), H - 22);
    }
  }, [result, idx, width, height, stars]);

  const onMove = (e) => {
    const g = geomRef.current;
    if (!g || !result) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const az = ((x - PAD.l) / g.W) * 360;
    if (az < 0 || az > 360 || y > g.H) return setHover(null);
    setHover({ x, y, az, hor: horizonAt(result.mask, az) });
  };

  const exag = geomRef.current?.exaggeration;
  return (
    <div>
      <div className="chart-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvasRef} role="img"
          aria-label="Horizon panorama showing terrain, the Sun's path and Earth's path over the mission window" />
        {hover && (
          <>
            <div style={{ position: "absolute", left: hover.x, top: 0, height: geomRef.current.H, width: 1, background: "#ffffff50", pointerEvents: "none" }} />
            <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
              <span className="t">AZ </span><b>{hover.az.toFixed(1)}°</b><br />
              <span className="t">TERRAIN </span><b>{fmtDeg(hover.hor, 2)}</b>
            </div>
          </>
        )}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--sun)" }} />Sun path</span>
        <span><i style={{ background: "repeating-linear-gradient(90deg,var(--sun) 0 2px,transparent 2px 6px)", opacity: .6 }} />Sun behind terrain</span>
        <span><i style={{ background: "var(--earth)" }} />Earth path, link open</span>
        <span><i style={{ background: "repeating-linear-gradient(90deg,var(--earth) 0 2px,transparent 2px 6px)", opacity: .6 }} />Earth blocked</span>
        <span><i style={{ background: "var(--terrain-edge)", height: 1 }} />Terrain horizon (LOLA)</span>
        {exag > 1.5 && <span style={{ marginLeft: "auto" }} className="mono">VERTICAL ×{Math.round(exag)}</span>}
      </div>
    </div>
  );
}
