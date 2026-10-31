import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSites } from "./lib/data.js";
import { computeScenario, stepMinutesFor } from "./lib/scenario.js";
import { fmtUTC, fmtLatLon, fmtDuration } from "./lib/format.js";
import Sidebar from "./components/Sidebar.jsx";
import Panorama from "./components/Panorama.jsx";
import Timeline from "./components/Timeline.jsx";
import { CompareTable, MetricCards } from "./components/Metrics.jsx";
import SweepView from "./components/SweepView.jsx";
import LearnView from "./components/LearnView.jsx";

const COLORS = ["var(--scn-1)", "var(--scn-2)", "var(--scn-3)"];
const DAY = 86400e3;
// Demo story: a perfect Malapert window, then a two-week launch slip.
const DEFAULT_START = Date.UTC(2027, 7, 16, 0, 0);

const DEFAULT_SETTINGS = {
  durationDays: 14, mastIdx: 1, panel: "vertical", commMarginDeg: 1, sustainedHours: 6, batteryHours: 50,
};

let keySeq = 0;
const newKey = () => `s${++keySeq}`;

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTabState] = useState(() => (["plan", "sweep", "learn"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "plan"));
  const setTab = (t) => { setTabState(t); history.replaceState(null, "", `#${t}`); };
  const [scenarios, setScenarios] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [results, setResults] = useState({});
  const [cursorH, setCursorH] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    loadSites().then((m) => {
      setMeta(m);
      const pick = (id) => m.sites.find((s) => s.id === id);
      const init = [
        { key: newKey(), site: pick("malapert"), startMs: DEFAULT_START },
        { key: newKey(), site: pick("malapert"), startMs: DEFAULT_START + 14 * DAY },
        { key: newKey(), site: pick("slater-plain"), startMs: DEFAULT_START + 14 * DAY },
      ];
      setScenarios(init);
      setActiveKey(init[0].key);
    }).catch((e) => setError(e.message));
  }, []);

  const setSettings = useCallback((patch) => setSettingsState((s) => ({ ...s, ...patch })), []);

  const colored = useMemo(() => {
    const used = new Map();
    return scenarios.map((s, i) => {
      if (!used.has(s.key)) used.set(s.key, COLORS[i % COLORS.length]);
      return { ...s, color: used.get(s.key) };
    });
  }, [scenarios]);

  // compute every scenario when it or the settings change
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    (async () => {
      for (const sc of scenarios) {
        const r = await computeScenario(sc, settings, meta).catch((e) => ({ error: e.message }));
        if (cancelled) return;
        setResults((prev) => ({ ...prev, [sc.key]: r }));
      }
    })();
    return () => { cancelled = true; };
  }, [scenarios, settings, meta]);

  const updateScenario = (key, patch) => setScenarios((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addScenario = () => {
    const base = scenarios.find((s) => s.key === activeKey) || scenarios[0];
    const sc = { key: newKey(), site: base.site, startMs: base.startMs + 14 * DAY };
    setScenarios((ss) => [...ss, sc]);
    setActiveKey(sc.key);
  };
  const removeScenario = (key) => {
    setScenarios((ss) => {
      const next = ss.filter((s) => s.key !== key);
      if (key === activeKey) setActiveKey(next[0]?.key);
      return next;
    });
  };
  const openFromSweep = (site, startMs) => {
    updateScenario(activeKey, { site, startMs });
    setCursorH(0);
    setTab("plan");
  };

  // playback: sweep the whole window in ~20 s
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const total = settings.durationDays * 24;
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setCursorH((h) => {
        const nh = h + (dt * total) / 20;
        if (nh >= total) { setPlaying(false); return total; }
        return nh;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, settings.durationDays]);

  useEffect(() => { setCursorH((h) => Math.min(h, settings.durationDays * 24)); }, [settings.durationDays]);

  if (error) return <div className="loading error">Could not load data: {error}</div>;
  if (!meta || !activeKey) return <div className="loading">Loading AS75 Lab…</div>;

  const active = colored.find((s) => s.key === activeKey);
  const activeRes = results[activeKey];
  const ready = activeRes?.ts;
  const stepMin = stepMinutesFor(settings.durationDays);
  const idx = Math.round((cursorH * 60) / stepMin);
  const items = colored.map((s) => ({ key: s.key, color: s.color, site: s.site, label: s.site.name, result: results[s.key] }))
    .filter((it) => it.result?.ts);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <h1>AS75 Lab</h1>
            <p>Lunar landing sites: sunlight, terrain &amp; Earth link</p>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          {[["plan", "Plan & compare"], ["sweep", "Date sweep"], ["learn", "Why it's hard"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <div className="spacer" />
        <span className="note">NASA SPICE DE440 · LOLA terrain · all times UTC</span>
      </header>

      {tab === "plan" && (
        <div className="layout">
          <Sidebar meta={meta} scenarios={colored} activeKey={activeKey} setActive={setActiveKey}
            updateScenario={updateScenario} addScenario={addScenario} removeScenario={removeScenario}
            settings={settings} setSettings={setSettings} results={results} />
          <main className="main">
            <section className="panel">
              <div className="panel-head">
                <h2>
                  <span className="swatch" style={{ "--scn": active.color, display: "inline-block", marginRight: 8 }} />
                  {active.site.name}
                  <span className="sub">{fmtLatLon(active.site.lat, active.site.lon)}{activeRes?.heightM != null && ` · ${Math.round(activeRes.heightM)} m`}</span>
                </h2>
                <span className="hint">Sky as seen from the lander, 360° around</span>
              </div>
              {activeRes?.error && <p className="error">{activeRes.error}</p>}
              {ready ? (
                <>
                  <Panorama result={activeRes} idx={idx} />
                  <div className="scrubber">
                    <button className="btn primary" onClick={() => { if (cursorH >= settings.durationDays * 24) setCursorH(0); setPlaying((p) => !p); }}>
                      {playing ? "❚❚ Pause" : "▶ Play"}
                    </button>
                    <input type="range" min="0" max={settings.durationDays * 24} step={stepMin / 60} value={cursorH}
                      aria-label="Mission time" onChange={(e) => { setPlaying(false); setCursorH(+e.target.value); }} />
                    <span className="time">
                      {fmtUTC(activeRes.ts.t[Math.min(idx, activeRes.ts.t.length - 1)])} UTC · L+{fmtDuration(cursorH)}
                    </span>
                  </div>
                </>
              ) : !activeRes?.error && <div className="loading">Computing…</div>}
            </section>

            {ready && (
              <section className="panel">
                <h2>At this moment <span className="sub">and over the {settings.durationDays}-day window</span></h2>
                <MetricCards result={activeRes} idx={idx} settings={settings} />
              </section>
            )}

            {items.length > 0 && (
              <section className="panel">
                <h2>Timeline <span className="sub">aligned on landing time, so different dates compare directly</span></h2>
                <Timeline items={items} durationDays={settings.durationDays} cursorH={cursorH}
                  onSeek={(h) => { setPlaying(false); setCursorH(h); }} />
              </section>
            )}

            {items.length > 0 && (
              <section className="panel">
                <h2>Side by side <span className="sub">★ = best of the scenarios</span></h2>
                <CompareTable items={items} />
              </section>
            )}
          </main>
        </div>
      )}
      {tab === "sweep" && <SweepView meta={meta} settings={settings} scenarios={colored} onOpen={openFromSweep} />}
      {tab === "learn" && <LearnView meta={meta} />}
    </div>
  );
}
