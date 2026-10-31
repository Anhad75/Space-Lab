# AS75 Lab

**Compare lunar landing sites and dates by sunlight, terrain horizon and direct-to-Earth visibility, in seconds.**

Team AS75 Lab · NASA Space Apps Challenge 2026

At the Moon's south pole the Sun never rises more than about 2°, so a ridge one degree high decides whether a lander has power. Earth also sits on the horizon and wobbles above and below it. AS75 Lab turns NASA ephemeris and LOLA terrain data into views that planners, students and the public can read at a glance:

- **Horizon panorama**: the 360° skyline seen from the lander, with the Sun's and Earth's paths over the mission window, and play/scrub through time.
- **Live metrics**: Sun and Earth elevation above the *terrain*, time to the next loss of sun, sustained sunset and Earthset, and a viability verdict.
- **Scenario comparison**: up to three site + date combinations side by side, with one-click date slips (±1, ±7, +14 days).
- **Date sweep heatmap**: the score of every possible landing day for every polar site over 18 months. It shows at once which windows survive a launch slip and which site rescues a fixed date.
- **Custom sites**: click anywhere on the south-pole map and the terrain horizon is computed live in the browser.
- **Mast height and panel type**: see how a few metres of height change illumination.
- **Why it's hard**: explainers backed by live numbers (permanent shadow, libration, two-week nights, the slope that tipped IM-1).

## How it works

```
OFFLINE (Python, pipeline/)                         STATIC WEB APP (web/)
  SPICE DE440 + lunar orientation ──► ephem/<year>.bin   geometry.js: az/el for any site/time
    Sun dir + Earth vector, MOON_ME, hourly              sunlit fraction, eclipses, events
  LOLA DEMs 40 m / 240 m / global ──► horizons/<site>.bin  terrain.js: live horizon for clicks
    720-azimuth horizon masks, 6 mast heights            React views: panorama, timeline,
  ──► dem/south_*.bin (browser terrain), map PNG         heatmap, comparison, learn
```

No server: the app is plain static files (about 17 MB of data, loaded on demand).

## Validation

| Check | Result |
|---|---|
| SPICE pipeline vs **JPL Horizons** (Sun & Earth az/el, south-pole site and Apollo 11, Nov 2026) | 0.0000° worst difference |
| Browser geometry vs SPICE `azlcpo` (48 cases, 1969–2032) | 0.0007° worst difference |
| Browser 240 m horizon vs pipeline 40 m horizon (polar sites) | ≤ 0.54° mean difference (≤ 0.06° on smooth ground) |
| DEM orientation | Mons Mouton & Malapert come out high, Cabeus, Haworth, Shackleton & de Gerlache low |
| Real events | Finds the 17 Aug 2027 penumbral lunar eclipse; IM-1 site slope 12.4° |

Run the checks: `python pipeline/validate_horizons.py` and `cd web && npm test`.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Rebuild the data (only needed to change sites or years). Download the SPICE kernels and LOLA DEMs listed in `pipeline/common.py` and `pipeline/dem.py` into `C:\nasa-data` (or set `AS75_DATA`), then:

```bash
python -m venv .venv && .venv/Scripts/pip install -r pipeline/requirements.txt
cd pipeline
python build_ephemeris.py && python optimize_sites.py && python build_horizons.py && python build_map.py && python build_reference.py
```

## Assumptions

- "Sunlit" = at least half of the solar disk above the terrain; eclipses by Earth included.
- "Earth visible" = Earth's centre at least the comm margin (default 1°) above the terrain. Ground stations are assumed to always see the Moon.
- Power factor: vertical sun-tracking panel (cos of Sun elevation) or flat panel (sin), times the visible fraction of the Sun. Dust, temperature and degradation are ignored.
- Artemis III candidate regions: NASA publishes names, not points. Ours are the best-lit points with slope ≤ 8° that we found near approximate positions, and they are labelled as such.

## Data sources

NASA/NAIF SPICE generic kernels (DE440, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`) · LRO LOLA gridded data records (PDS Geosciences Node) · JPL Horizons (validation).
