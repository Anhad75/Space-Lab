import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSites } from "./lib/data.js";
import { computeScenario, stepMinutesFor } from "./lib/scenario.js";
import { fmtUTC, fmtLatLon, fmtDuration } from "./lib/format.js";
import Controls, { AssumptionsBar } from "./components/Sidebar.jsx";
import Panorama from "./components/Panorama.jsx";
import Timeline from "./components/Timeline.jsx";
import { CompareTable, Readouts, Stamp } from "./components/Metrics.jsx";
import SweepView from "./components/SweepView.jsx";
import LearnView from "./components/LearnView.jsx";

const COLORS = ["var(--scn-1)", "var(--scn-2)", "var(--scn-3)"];
const DAY = 86400e3;
// Demo story: a perfect Malapert window, then a two-week launch slip.
const DEFAULT_START = Date.UTC(2027, 7, 16, 0, 0);

const DEFAULT_SETTINGS = {
  durationDays: 14, mastIdx: 1, panel: "vertical", commMarginDeg: 1, sustainedHours: 6, batteryHours: 50, maxBlackoutHours: 72,
};
const TABS = [["plan", "Plan & compare"], ["sweep", "Date sweep"], ["learn", "Why it's hard"]];

let keySeq = 0;
const newKey = () => `s${++keySeq}`;

function Clock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <span className="eyebrow">Earth UTC</span>
      <span className="num">{new Date(now).toISOString().slice(0, 19).replace("T", " ")}</span>
      <span className="live" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const tabFromHash = () => (TABS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : "plan");
  const [tab, setTabState] = useState(tabFromHash);
  const setTab = (t) => { if (location.hash !== `#${t}`) location.hash = t; setTabState(t); };
  // back/forward buttons and links like #sweep in slides
  useEffect(() => {
    const onHash = () => { setTabState(tabFromHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
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

  // colour follows the scenario, not its position
  const colorOf = useRef(new Map());
  const colored = useMemo(() => {
    const taken = new Set([...colorOf.current.entries()].filter(([k]) => scenarios.some((s) => s.key === k)).map(([, c]) => c));
    return scenarios.map((s) => {
      if (!colorOf.current.has(s.key)) {
        const c = COLORS.find((x) => !taken.has(x)) || COLORS[0];
        colorOf.current.set(s.key, c);
        taken.add(c);
      }
      return { ...s, color: colorOf.current.get(s.key) };
    });
  }, [scenarios]);

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

  // playback: the whole window in ~20 s
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

  const header = (
    <header className="topbar">
      <a className="logo" href="#plan" onClick={(e) => { e.preventDefault(); setTab("plan"); }}>
        <span className="mark" aria-hidden="true" /><b>AS75</b><i>Lab</i>
      </a>
      <nav className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      <Clock />
    </header>
  );

  if (error) return <>{header}<div className="loading error">Could not load data: {error}</div></>;
  if (!meta || !activeKey) return <>{header}<div className="loading">Loading ephemeris &amp; terrain…</div></>;

  const active = colored.find((s) => s.key === activeKey);
  const activeRes = results[activeKey];
  const ready = activeRes?.ts;
  const stepMin = stepMinutesFor(settings.durationDays);
  const idx = Math.round((cursorH * 60) / stepMin);
  const items = colored.map((s) => ({ key: s.key, color: s.color, site: s.site, label: s.site.name, result: results[s.key] }))
    .filter((it) => it.result?.ts);
  const letter = (k) => String.fromCharCode(65 + colored.findIndex((s) => s.key === k));

  return (
    <div className="app">
      {header}

      {tab === "plan" && (
        <>
          <div className="strip" style={{ "--n": colored.length }}>
            <div className="strip-lede">
              <span className="eyebrow">Mission scenarios</span>
              <h1>Where and when can a lander see the <em>Sun</em> and talk to Earth?</h1>
            </div>
            {colored.map((sc) => {
              const r = results[sc.key];
              return (
                <button key={sc.key} className="scn" style={{ "--c": sc.color }} aria-current={sc.key === activeKey}
                  onClick={() => setActiveKey(sc.key)}>
                  <span className="scn-top">
                    <span className="eyebrow" style={{ color: sc.color }}>Scenario {letter(sc.key)}</span>
                    {colored.length > 1 && (
                      <span className="scn-x" role="button" aria-label={`Remove scenario ${letter(sc.key)}`}
                        onClick={(e) => { e.stopPropagation(); removeScenario(sc.key); }}>×</span>
                    )}
                  </span>
                  <span className="scn-name">{sc.site.name}</span>
                  <span className="scn-date">{fmtUTC(sc.startMs)} UTC</span>
                  {r?.ts ? <Stamp verdict={r.verdict} reason /> : <span className="hint">{r?.error ? "No data" : "Computing…"}</span>}
                </button>
              );
            })}
            {colored.length < 3 && <button className="add-scn" onClick={addScenario}>+ Compare</button>}
          </div>

          <div className="work">
            <Controls meta={meta} scenario={active} letter={letter(activeKey)} scenarios={colored} activeKey={activeKey}
              updateScenario={updateScenario} setSettings={setSettings} result={activeRes}
              onReplay={(site, startMs, durationDays) => { updateScenario(activeKey, { site, startMs }); setSettings({ durationDays }); setCursorH(0); }} />

            <main className="stage">
              <AssumptionsBar meta={meta} settings={settings} setSettings={setSettings} />
              <section className="section">
                <div className="section-head">
                  <span className="idx">01</span>
                  <h2>Horizon view</h2>
                  <span className="meta">What a camera on the lander would see, all the way around</span>
                </div>
                {activeRes?.error && <p className="error">{activeRes.error}</p>}
                {ready ? (
                  <div className="viewport">
                    <div className="viewport-bar">
                      <span><b style={{ color: active.color }}>■</b> <b>{active.site.name.toUpperCase()}</b> · {fmtLatLon(active.site.lat, active.site.lon)} · {Math.round(activeRes.heightM)} M</span>
                      <span>TERRAIN {activeRes.source.toUpperCase()}</span>
                    </div>
                    <Panorama result={activeRes} idx={idx} />
                    <div className="transport">
                      <button className="play" aria-label={playing ? "Pause" : "Play"}
                        onClick={() => { if (cursorH >= settings.durationDays * 24) setCursorH(0); setPlaying((p) => !p); }}>
                        {playing
                          ? <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
                          : <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1l8 5-8 5z" fill="currentColor" /></svg>}
                      </button>
                      <input type="range" min="0" max={settings.durationDays * 24} step={stepMin / 60} value={cursorH}
                        aria-label="Mission time" onChange={(e) => { setPlaying(false); setCursorH(+e.target.value); }} />
                      <span className="num">{fmtUTC(activeRes.ts.t[Math.min(idx, activeRes.ts.t.length - 1)])} UTC</span>
                      <span className="num elapsed">L+{fmtDuration(cursorH) === "0 m" ? "0" : fmtDuration(cursorH)}</span>
                    </div>
                  </div>
                ) : !activeRes?.error && <div className="loading">Computing…</div>}
              </section>

              {ready && (
                <section className="section">
                  <div className="section-head">
                    <span className="idx">02</span>
                    <h2>Telemetry</h2>
                    <span className="meta">At the cursor time · verdict covers the full {settings.durationDays}-day window</span>
                  </div>
                  <Readouts result={activeRes} idx={idx} settings={settings} />
                </section>
              )}

              {items.length > 0 && (
                <section className="section">
                  <div className="section-head">
                    <span className="idx">03</span>
                    <h2>Operations timeline</h2>
                    <span className="meta">Aligned on touchdown, so different dates compare directly</span>
                  </div>
                  <Timeline items={items} durationDays={settings.durationDays} cursorH={cursorH}
                    onSeek={(h) => { setPlaying(false); setCursorH(h); }} />
                </section>
              )}

              {items.length > 0 && (
                <section className="section">
                  <div className="section-head">
                    <span className="idx">04</span>
                    <h2>Side by side</h2>
                    <span className="meta">▲ marks the best scenario on each line</span>
                  </div>
                  <CompareTable items={items} />
                </section>
              )}
            </main>
          </div>
        </>
      )}
      {tab === "sweep" && <SweepView meta={meta} settings={settings} setSettings={setSettings} scenarios={colored} onOpen={openFromSweep} />}
      {tab === "learn" && <LearnView meta={meta} />}
    </div>
  );
}
