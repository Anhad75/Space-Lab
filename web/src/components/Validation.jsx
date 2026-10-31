// "Checked against reality": PGDA illumination scatter plots + historical landings.
import { useEffect, useState } from "react";

const BASE = `${import.meta.env.BASE_URL}data/validation/`;

function Scatter({ points, key1, key2, color, title, stat }) {
  const S = 260, P = 34;
  const X = (v) => P + v * (S - P - 8);
  const Y = (v) => S - P - v * (S - P - 8);
  const [tip, setTip] = useState(null);
  return (
    <figure className="scatter">
      <figcaption><span className="eyebrow">{title}</span><span className="mono">r = {stat.r.toFixed(3)} · mean |Δ| {stat.meanAbsDiffPct} pts</span></figcaption>
      <div className="chart-wrap" style={{ maxWidth: S }}>
        <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${title}: AS75 Lab versus NASA PGDA, ${points.length} points`}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={X(0)} x2={X(1)} y1={Y(t)} y2={Y(t)} stroke="#ffffff10" />
              <line x1={X(t)} x2={X(t)} y1={Y(0)} y2={Y(1)} stroke="#ffffff10" />
              <text x={X(t)} y={S - P + 14} fontSize="9" fill="var(--ink-3)" textAnchor="middle">{t * 100}%</text>
              <text x={P - 6} y={Y(t) + 3} fontSize="9" fill="var(--ink-3)" textAnchor="end">{t * 100}%</text>
            </g>
          ))}
          <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="#ffffff55" strokeDasharray="3 3" />
          {points.map((p, i) => (
            <circle key={i} cx={X(p[key2])} cy={Y(p[key1])} r="3" fill={color} fillOpacity="0.75" stroke="var(--bg-raised)" strokeWidth="1"
              onMouseEnter={() => setTip({ p, x: X(p[key2]), y: Y(p[key1]) })} onMouseLeave={() => setTip(null)} />
          ))}
          <text x={(S + P) / 2} y={S - 4} fontSize="9.5" fill="var(--ink-2)" textAnchor="middle">NASA PGDA (Mazarico et al.)</text>
          <text x={10} y={(S - P) / 2} fontSize="9.5" fill="var(--ink-2)" textAnchor="middle" transform={`rotate(-90 10 ${(S - P) / 2})`}>AS75 Lab</text>
        </svg>
        {tip && (
          <div className="tooltip" style={{ left: `${(tip.x / S) * 100}%`, top: `${(tip.y / S) * 100}%` }}>
            <span className="t">{tip.p.name || `${Math.abs(tip.p.lat).toFixed(2)}°S ${tip.p.lon.toFixed(1)}°E`}</span><br />
            Ours <b>{(tip.p[key1] * 100).toFixed(1)}%</b> · PGDA <b>{(tip.p[key2] * 100).toFixed(1)}%</b>
          </div>
        )}
      </div>
    </figure>
  );
}

export default function Validation() {
  const [pg, setPg] = useState(null);
  const [hist, setHist] = useState(null);
  useEffect(() => {
    fetch(BASE + "pgda.json").then((r) => r.json()).then(setPg).catch(() => {});
    fetch(BASE + "historical.json").then((r) => r.json()).then(setHist).catch(() => {});
  }, []);
  const a11 = hist?.find((h) => h.id === "a11");
  const ch3 = hist?.find((h) => h.id === "ch3");

  return (
    <article className="chapter">
      <div className="no">07</div>
      <div>
        <h2>Checked against reality.</h2>
        <p>Every number on this site comes from one engine, and we tested it four independent ways.</p>
        <table className="compare checks">
          <tbody>
            <tr><th>Sun &amp; Earth positions vs <b>JPL Horizons</b></th><td>0.0001°</td></tr>
            <tr><th>Browser engine vs NASA <b>SPICE</b> (48 cases, 1969–2032)</th><td>0.0007°</td></tr>
            <tr><th>Sunlight vs NASA <b>PGDA</b> illumination map (300 random polar points)</th><td>{pg ? `r = ${pg.summary.sun.r.toFixed(3)}` : "…"}</td></tr>
            <tr><th>Earth visibility vs NASA <b>PGDA</b> Earth map</th><td>{pg ? `r = ${pg.summary.earth.r.toFixed(3)}` : "…"}</td></tr>
            <tr><th>Permanent shadows found by both</th><td>{pg ? pg.summary.psrAgree : "…"}</td></tr>
            <tr><th><b>Apollo 11</b> Sun elevation at touchdown (NASA: 10.8°)</th><td>{a11 ? `${a11.sunElAtLanding}°` : "…"}</td></tr>
            <tr><th><b>Chandrayaan-3</b> terrain sunset (ISRO put Vikram to sleep 4 Sep 2023)</th><td>{ch3 ? `${ch3.sunset.slice(0, 10)}` : "…"}</td></tr>
          </tbody>
        </table>
        {pg && (
          <p style={{ marginTop: 14 }}>
            On sunlit ground alone, {pg.summary.sunLitOnly.within5PtsPct}% of points agree with NASA within 5 percentage points (median difference {pg.summary.sunLitOnly.medianAbsDiffPct} pts).
            The biggest gaps are on sharp peaks such as Malapert, where NASA's 60 m map and our 40 m map sample slightly different ground.
          </p>
        )}
      </div>
      <div className="figure scatters">
        {pg && <Scatter points={pg.random} key1="ours_sun" key2="pgda_sun" color="var(--sun)" title="Time sunlit" stat={pg.summary.sun} />}
        {pg && <Scatter points={pg.random} key1="ours_earth" key2="pgda_earth" color="var(--earth)" title="Time Earth visible" stat={pg.summary.earth} />}
      </div>
    </article>
  );
}
