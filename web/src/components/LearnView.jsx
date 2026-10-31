// "Why is the lunar south pole so hard?": short explainers backed by live numbers.
import { useEffect, useState } from "react";
import { ensureYears, ephemeris, loadSiteMasks } from "../lib/data.js";
import { metrics, siteFrame, timeSeries } from "../lib/geometry.js";
import { fmtDuration, fmtPct } from "../lib/format.js";

const Y0 = Date.UTC(2027, 0, 1), Y1 = Date.UTC(2028, 0, 1);

function useYearStats(meta) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    (async () => {
      await ensureYears(Y0, Y1);
      const site = (id) => meta.sites.find((s) => s.id === id);
      const run = async (id, mastIdx) => {
        const s = site(id);
        const all = await loadSiteMasks(id);
        const mask = all.subarray(mastIdx * meta.nAz, (mastIdx + 1) * meta.nAz);
        const ts = timeSeries(ephemeris, siteFrame(s.lat, s.lon, s.heightM), Y0, Y1, 60, { mask, commMarginDeg: 1 });
        let maxSun = -90;
        for (let i = 0; i < ts.t.length; i++) maxSun = Math.max(maxSun, ts.sunEl[i]);
        return { ...metrics(ts, 6), maxSun };
      };
      const ridge = await Promise.all(meta.masts.map((_, k) => run("connecting-ridge", k)));
      setStats({
        ridge,
        shack: await run("shackleton", 1),
        a11: await run("a11", 1),
        ce4: await run("ce4", 1),
        ch3: await run("ch3", 1),
      });
    })();
  }, [meta]);
  return stats;
}

export default function LearnView({ meta }) {
  const s = useYearStats(meta);
  const n = (v, d = 1) => (v == null ? "…" : v.toFixed(d));
  return (
    <div className="learn">
      <section className="panel">
        <h3>☀️ The Sun never climbs at the pole</h3>
        <p>The Moon's spin axis is tilted only <b>1.54°</b> from the plane of its orbit around the Sun (Earth's is 23.4°). At the south pole the Sun circles the whole horizon once every 29.5 days and never gets higher than 1.54° plus the site's distance from the pole, so only about 2° even half a degree away.</p>
        <div className="big-number">{s ? `${n(s.ridge[1].maxSun, 2)}°` : "…"}</div>
        <p className="hint">Highest Sun elevation at Connecting Ridge in all of 2027 (computed live from NASA SPICE ephemeris).</p>
      </section>

      <section className="panel">
        <h3>⛰️ So terrain decides everything</h3>
        <p>With the Sun skimming the horizon, a ridge 1° high can mean darkness. Two spots about 15 km apart:</p>
        <div className="row">
          <div><div className="big-number" style={{ color: "var(--sun)" }}>{s ? fmtPct(s.ridge[1].sunlitPct) : "…"}</div><p className="hint">Connecting Ridge sunlit in 2027 (horizon ≈ 0°)</p></div>
          <div><div className="big-number">{s ? fmtPct(s.shack.sunlitPct) : "…"}</div><p className="hint">Shackleton crater floor (walls ≈ 21° high): permanent shadow, where water ice survives</p></div>
        </div>
      </section>

      <section className="panel">
        <h3>📡 A few metres of mast matter</h3>
        <p>Raising solar panels lets them see over nearby bumps. Sunlit fraction at Connecting Ridge over 2027, by panel height:</p>
        <table className="compare">
          <tbody>
            {meta.masts.map((m, k) => (
              <tr key={m}><th>{m} m</th><td>{s ? fmtPct(s.ridge[k].sunlitPct) : "…"}</td><td>{s ? `longest night ${fmtDuration(s.ridge[k].longestDarkH)}` : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>🌍 Earth hangs still, but wobbles</h3>
        <p>The Moon always shows Earth the same face, so from any site Earth stays in almost the same spot in the sky. <b>Libration</b>, a slow wobble of about ±7°, moves it a little. At the pole Earth sits right on the horizon, so the wobble makes it set and rise over a ~27-day cycle.</p>
        <div className="row" style={{ "--big": "26px" }}>
          <div><div className="big-number" style={{ color: "var(--earth)" }}>{s ? fmtPct(s.ridge[1].earthPct) : "…"}</div><p className="hint">Earth in view at Connecting Ridge (2027)</p></div>
          <div><div className="big-number">{s ? fmtPct(s.a11.earthPct) : "…"}</div><p className="hint">Apollo 11 (near side, mid-latitude)</p></div>
          <div><div className="big-number">{s ? fmtPct(s.ce4.earthPct) : "…"}</div><p className="hint">Chang'e-4, far side: needed the Queqiao relay satellite</p></div>
        </div>
      </section>

      <section className="panel">
        <h3>🌗 Lunar nights are two weeks long</h3>
        <p>Away from the poles, every site gets ~14.8 days of sunlight and then ~14.8 days of darkness, when it gets cold enough to freeze most electronics. Chandrayaan-3 landed just after local sunrise to get a full lunar day of power, then went silent at sunset.</p>
        <div className="big-number">{s ? fmtDuration(s.ch3.longestDarkH) : "…"}</div>
        <p className="hint">Longest night at the Chandrayaan-3 site in 2027. Polar ridges cut that down, which is why everyone is going there.</p>
      </section>

      <section className="panel">
        <h3>🛬 Slope can end a mission</h3>
        <p>IM-1 Odysseus landed near Malapert A in February 2024, caught a foot and tipped onto its side. LOLA's 40 m map gives the ground there a slope of <b>{meta.sites.find((x) => x.id === "im1")?.slopeDeg}°</b>. Most landers are designed for less than about 8–10°. AS75 Lab shows the slope of every polar site and only suggests flat points.</p>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h3>🔬 How AS75 Lab computes this, and how we checked it</h3>
        <p><b>Ephemeris:</b> NASA/NAIF SPICE (DE440 planets, DE440 lunar orientation), in the MOON_ME frame that LOLA maps and published site coordinates use. Sun and Earth vectors are stored hourly for 1969–72 and 2023–32 (2.9 MB) and interpolated in your browser. <b>Checked:</b> identical to JPL Horizons to 0.0001° at a south-pole site and at Apollo 11. The browser math matches SPICE to within 0.0007° across 48 cases from 1969 to 2032.</p>
        <p><b>Terrain:</b> LOLA digital elevation maps (40 m within 25 km of the site, 240 m out to 200 km, the global 1.9 km map elsewhere). The horizon is ray-traced over 720 azimuths with exact lunar curvature and no atmosphere (so no refraction). Custom map clicks use a 240 m map computed live in your browser (within about 0.5° of the 40 m result on rugged ground).</p>
        <p><b>Rules:</b> "Sunlit" = at least half of the Sun's 0.53° disk above the terrain. Eclipses by Earth are included. "Earth visible" = Earth's centre at least the comm margin above the terrain. We assume a ground station always sees the Moon (NASA's three Deep Space Network sites are 120° apart). Power uses a vertical sun-tracking panel (or a flat one) and ignores dust and temperature.</p>
        <p><b>Artemis III regions:</b> NASA publishes region names, not exact points. For each region we searched our approximate point's surroundings for the best-lit spot with slope ≤ 8° and label those as approximate.</p>
      </section>
    </div>
  );
}
