// "Why is the lunar south pole so hard?": an editorial explainer backed by live numbers.
import { useEffect, useState } from "react";
import { ensureYears, ephemeris, loadSiteMasks } from "../lib/data.js";
import { metrics, siteFrame, timeSeries } from "../lib/geometry.js";
import { fmtDuration, fmtPct } from "../lib/format.js";
import Validation from "./Validation.jsx";

const Y0 = Date.UTC(2027, 0, 1), Y1 = Date.UTC(2028, 0, 1);

function useYearStats(meta) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    (async () => {
      await ensureYears(Y0, Y1);
      const run = async (id, mastIdx) => {
        const s = meta.sites.find((x) => x.id === id);
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

function Chapter({ no, title, children, figure }) {
  return (
    <article className="chapter">
      <div className="no">{no}</div>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      <div className="figure">{figure}</div>
    </article>
  );
}

function Fig({ value, caption, tone }) {
  return (
    <div>
      <div className={`fig-num ${tone || ""}`}>{value ?? "…"}</div>
      <div className="fig-cap">{caption}</div>
    </div>
  );
}

export default function LearnView({ meta }) {
  const s = useYearStats(meta);
  const im1 = meta.sites.find((x) => x.id === "im1");
  return (
    <div className="essay">
      <header className="essay-hero">
        <div>
          <span className="eyebrow">Field notes · lunar south pole</span>
          <h1>Why a <em>few metres</em> decide whether a lander lives.</h1>
        </div>
        <p>
          Every number on this page is computed live in your browser from NASA's DE440 ephemeris and LRO laser
          altimetry, using the same engine as the planner. All figures are for the year 2027 unless stated.
        </p>
      </header>

      <Chapter no="01" title="The Sun never climbs."
        figure={<Fig tone="sun" value={s && `${s.ridge[1].maxSun.toFixed(2)}°`} caption="Highest the Sun gets all year at Connecting Ridge, half a degree from the pole." />}>
        <p>The Moon's spin axis is tilted just <b>1.54°</b> from the plane of its orbit around the Sun, compared with 23.4° for Earth. Near the pole the Sun doesn't rise and set. It circles the whole horizon once every 29.5 days, never higher than that tilt plus the site's distance from the pole.</p>
        <p>Solar arrays at the pole therefore stand <b>vertically</b> and turn to follow the Sun around the sky.</p>
      </Chapter>

      <Chapter no="02" title="So terrain decides everything."
        figure={<div className="fig-row">
          <Fig tone="sun" value={s && fmtPct(s.ridge[1].sunlitPct)} caption="Connecting Ridge: horizon near 0°" />
          <Fig value={s && fmtPct(s.shack.sunlitPct)} caption="Shackleton crater floor: walls ~21° high" />
        </div>}>
        <p>With the Sun skimming the horizon, a ridge one degree high is the difference between power and darkness. A ridge and a crater floor about <b>15 km apart</b> sit at opposite extremes.</p>
        <p>The crater floor has not seen sunlight for billions of years. That is why water ice can survive there, and why every agency wants to land on the bright rim next to it.</p>
      </Chapter>

      <Chapter no="03" title="A taller mast buys sunlight."
        figure={<div className="bars">
          {meta.masts.map((m, k) => {
            const v = s?.ridge[k].sunlitPct;
            return (
              <div className="bar" key={m}>
                <span>{m} m</span>
                <span className="track"><span className="fill" style={{ display: "block", width: v ? `${v}%` : 0 }} /></span>
                <span>{v ? fmtPct(v) : "…"}</span>
              </div>
            );
          })}
          <div className="fig-cap">Sunlit fraction at Connecting Ridge, by panel height</div>
        </div>}>
        <p>Raising the panels lets them look over nearby bumps. At Connecting Ridge the longest night falls from <b>{s ? fmtDuration(s.ridge[0].longestDarkH) : "…"}</b> at 1 m to <b>{s ? fmtDuration(s.ridge[5].longestDarkH) : "…"}</b> at 50 m. That is why NASA has studied tall solar towers for the pole.</p>
      </Chapter>

      <Chapter no="04" title="Earth hangs still, but it wobbles."
        figure={<div className="fig-row">
          <Fig tone="earth" value={s && fmtPct(s.ridge[1].earthPct)} caption="Connecting Ridge" />
          <Fig value={s && fmtPct(s.a11.earthPct)} caption="Apollo 11, near side" />
          <Fig value={s && fmtPct(s.ce4.earthPct)} caption="Chang'e-4, far side" />
        </div>}>
        <p>The Moon always keeps the same face toward us, so Earth barely moves in its sky. <b>Libration</b>, a slow nodding of about ±7°, is the exception. At the pole Earth sits right on the horizon, so that nod lifts it into view and drops it out again over roughly 27 days.</p>
        <p>On the far side Earth never rises at all. Chang'e-4 needed the Queqiao relay satellite to talk home.</p>
      </Chapter>

      <Chapter no="05" title="Nights last two weeks."
        figure={<Fig value={s && fmtDuration(s.ch3.longestDarkH)} caption="Longest night at the Chandrayaan-3 site, 69°S, including terrain shadow." />}>
        <p>Away from the poles, every site gets about 14.8 days of sunlight and then 14.8 days of darkness, cold enough to freeze most electronics. Chandrayaan-3 landed just after local sunrise to get a full lunar day of power, then fell silent at sunset.</p>
        <p>Polar ridges shorten those nights, which is why the south pole is worth the trouble.</p>
      </Chapter>

      <Chapter no="06" title="And the ground must be flat."
        figure={<Fig value={im1 ? `${im1.slopeDeg}°` : "…"} caption="Slope at the IM-1 Odysseus site in LOLA's 40 m map. The lander tipped onto its side in February 2024." />}>
        <p>The brightest ground is often the steepest. Most landers are designed for slopes below about 8–10°. AS75 Lab reports the slope of every polar site, and the Artemis region points it suggests are the best-lit spots it could find with a slope of <b>8° or less</b>.</p>
      </Chapter>

      <Validation />

      <section style={{ padding: "40px 0 0" }}>
        <span className="eyebrow">Method &amp; validation</span>
        <div className="methods" style={{ marginTop: 14 }}>
          <div>
            <h3>Ephemeris</h3>
            <p>NASA/NAIF SPICE: DE440 planets and lunar orientation, in the MOON_ME frame that LOLA and published coordinates use. Stored hourly for 1969–72 and 2023–32 and interpolated in the browser. <b>Matches JPL Horizons to 0.0001°</b>, and the browser math matches SPICE to 0.0007°. Sunlit and Earth-visible fractions match NASA PGDA maps (r ≈ 0.99).</p>
          </div>
          <div>
            <h3>Terrain</h3>
            <p>LOLA elevation maps: 40 m within 25 km of the site, 240 m to 200 km, and the global map elsewhere. The horizon is ray-traced at 720 azimuths with exact lunar curvature. There is no atmosphere, so no refraction. Map clicks use a 240 m map computed live in the browser.</p>
          </div>
          <div>
            <h3>Rules</h3>
            <p>Sunlit means at least half the 0.53° solar disk is above the terrain, and eclipses by Earth are included. Earth is visible when its centre is above the terrain plus the comm margin. Ground stations are assumed to always see the Moon. Power ignores dust and temperature.</p>
          </div>
          <div>
            <h3>Artemis regions</h3>
            <p>NASA names its candidate regions but doesn't publish exact points. Ours are the best-lit flat points found near approximate positions, and they are labelled as approximate throughout.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
