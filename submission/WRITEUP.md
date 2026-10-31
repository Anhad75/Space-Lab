# AS75 Lab: Space Apps submission text

Paste each section into the matching field of the Space Apps project page. Check the field names against this year's form before submitting; the content stays the same.

---

## Project name

AS75 Lab

## Team

AS75 Lab: _(your name(s) as registered)_. Claude was an AI collaborator; see "Use of Artificial Intelligence".

## Challenge

_(select this year's lunar landing-site Sun/Earth visibility challenge from the list on the form)_

## Links

- **Live app:** https://anhad75.github.io/Space-Lab/
- **Source code:** https://github.com/Anhad75/Space-Lab
- **Demo video:** _(add link)_

---

## High-level summary (short field)

AS75 Lab is a free web tool that tells a lunar mission planner, in seconds, whether a landing site and date will give a lander enough sunlight to survive and a direct line of sight to Earth. It draws the real terrain horizon that a lander would see, from NASA LOLA laser altimetry, and moves the Sun and Earth across it using NASA's DE440 ephemeris.

Planners can compare up to three site and date scenarios side by side. They can slip a launch by a day or two weeks and watch the verdict change, or scan every landing day for 18 months on one heatmap. Each verdict states its reason, for example "Fails: 2 d 22 h night > 50 h battery" or "Needs relay: Earth never in view".

The tool's results match JPL Horizons to 0.0001°. They also match NASA's published south-pole illumination maps with a correlation of 0.99, and reproduce the Sun angle at Apollo 11's touchdown.

## Detailed description

### What it does

At the Moon's south pole the Sun never rises more than about 2°, so a ridge one degree high decides whether a lander has power. Earth also sits on the horizon and slowly wobbles above and below it, so direct-to-Earth radio contact comes and goes. When a launch slips, engineers have to re-check these conditions for new dates or nearby sites. Today that means navigating several expert tools (Quickmap, Moon Trek, JPL Horizons) and interpreting raw data.

AS75 Lab answers the question directly:

- **Horizon view.** A 360° panorama of the terrain skyline seen from the lander, with the Sun's and Earth's paths over the mission window. Press play to watch a lunar day unfold. It centres on Earth automatically and can be dragged to rotate.
- **Telemetry.** Sun and Earth elevation above the *terrain*, time to the next loss of sun, the next sustained sunset (ignoring brief terrain flicker), and the next Earthset, at any moment.
- **Go/no-go verdict with a reason.** Hard gates come first: a night longer than the battery means **Fails**, and Earth never in view or a long blackout means **Needs relay**. Only then does a weighted score rank viable options. Good numbers elsewhere can never hide a mission-ending problem.
- **Scenario comparison.** Up to three site and date combinations on one timeline aligned on touchdown, with one-click schedule slips (−7, −1, +1, +7, +14 days).
- **Date sweep.** Every landing day for 18 months against every polar site, coloured go/no-go. Click a day to see which site rescues it and the nearest viable date.
- **Custom sites.** Click anywhere on the south-pole map, and the terrain horizon is ray-traced live in the browser.
- **Mission assumptions.** Battery endurance, comm blackout limit, solar array type, mast height (1–50 m) and comm margin all update every view instantly.
- **Replays of real landings.** IM-1, IM-2, Chandrayaan-3 and Apollo 11 each load in one click.
- **"Why it's hard".** An explainer for students and the public in which every claim has a live number: the 1.98° maximum Sun at Connecting Ridge, 56% vs 0% sunlight 15 km apart, Earth visible 42% / 100% / 0% at the pole, near side and far side, and the 12.4° slope at the site where IM-1 tipped over.

### How it works

1. **Ephemeris:** NASA/NAIF SPICE (DE440 planets, DE440 lunar orientation) gives Sun and Earth vectors in the MOON_ME frame, the frame that LOLA maps and published coordinates use. It is stored hourly for 1969–72 and 2023–32 (2.9 MB) and interpolated in the browser.
2. **Terrain:** LOLA digital elevation models (40 m near the site, 240 m to 200 km, global 1.9 km elsewhere). Horizons are ray-traced at 720 azimuths with exact lunar curvature and no atmospheric refraction, at six mast heights.
3. **Rules:** "Sunlit" means at least half of the 0.53° solar disk is above the terrain, and eclipses by Earth are included. "Earth visible" means Earth's centre is above the terrain plus a comm margin.
4. **App:** a fully static React site with no server. All geometry runs in the visitor's browser, so it is fast, free to host and works on a phone.

### Validation

| Check | Result |
|---|---|
| Sun and Earth positions vs JPL Horizons | 0.0001° |
| Browser engine vs NASA SPICE (48 cases, 1969–2032) | 0.0007° |
| Time sunlit vs NASA PGDA illumination map (300 random polar points, 18.6-year cycle) | r = 0.993, mean difference 0.7 percentage points |
| Earth visibility vs NASA PGDA Earth-visibility map | r = 0.995 |
| Permanently shadowed points found by both | 47 / 47 |
| Apollo 11 Sun elevation at touchdown (NASA: 10.8°) | 10.7° |
| Chandrayaan-3 terrain sunset | 4 Sep 2023, the day ISRO put Vikram to sleep |

It also found, unprompted, the penumbral lunar eclipse of 17 Aug 2027 as a 3-hour dip in sunlight.

### Benefits and impact

- **Mission planners** can answer "the launch slipped two weeks: are we still alive, and where?" in under a minute instead of hours across several tools.
- **Science and engineering teams** share one picture of the trade-off between scientifically interesting terrain and survivable terrain.
- **Students and the public** see *why* the lunar south pole is so hard: a few metres of height, one degree of horizon or one week of date can end a mission.

### Tools and languages

Python (spiceypy, NumPy) for the offline data pipeline. JavaScript, React and Vite for the web app. GitHub Actions and GitHub Pages for automatic testing and deployment.

### Limitations (stated honestly)

- NASA publishes Artemis III candidate *regions*, not points. Our points are the best-lit spots with slope ≤ 8° that we found near approximate positions, and the app labels them as approximate.
- Custom map clicks use a 240 m terrain map, accurate to about 0.5° on rugged ground. Curated sites use 40 m.
- We assume a ground station can always see the Moon. Power ignores dust, temperature and panel degradation.

---

## Use of NASA data

- **NASA/NAIF SPICE generic kernels:** DE440 planetary ephemeris (`de440s.bsp`), lunar orientation (`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`), leap seconds and planetary constants.
- **LRO LOLA gridded elevation models** (PDS Geosciences Node): `LDEM_80S_40M`, `LDEM_60S_240M`, `LDEM_16`.
- **NASA PGDA Lunar Polar Illumination** (Mazarico et al. 2011, 2016 release): `AVGVISIB_85S_060M` Sun and Earth average visibility, used for validation.
- **JPL Horizons:** used to validate Sun and Earth positions from a lunar surface site.
- **NASA Artemis III candidate region names** and **CLPS landing sites** (IM-1, IM-2, Blue Ghost M1).

## Other space agency data

Published landing coordinates and dates for ISRO Chandrayaan-3, JAXA SLIM, CNSA Chang'e-4 and Chang'e-6, and the Roscosmos Luna-25 target site.

## References

- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211(2). doi:10.1016/j.icarus.2010.10.030
- Smith, D. E. et al. (2010). The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission. *Space Science Reviews* 150.
- Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planetary and Space Science* 44(1).
- Park, R. S. et al. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. *The Astronomical Journal* 161(3).
- NASA (2024). NASA provides update on Artemis III Moon landing regions.

## Use of Artificial Intelligence

We used Claude (Anthropic) as an AI collaborator. It wrote most of the code for the data pipeline and the web app, ran and interpreted the validation against JPL Horizons, NASA SPICE and NASA PGDA, and drafted this text and the presentation script. The team set the goals and scope, reviewed and tested the app, made the design decisions, recorded the video and is responsible for the submission. All data comes from the NASA and agency sources listed above. No AI-generated imagery is presented as real data.
