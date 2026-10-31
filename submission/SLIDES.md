# AS75 Lab: slide deck content (7 slides)

One idea per slide. Use screenshots from the live app; suggested captures are listed per slide.

---

## 1 · Title

**AS75 Lab**
*Where and when can a lander see the Sun and talk to Earth?*

NASA Space Apps Challenge 2026 · Team AS75 Lab
anhad75.github.io/Space-Lab

**Visual:** the horizon view at Malapert Massif with the Sun glowing on the ridge.

---

## 2 · The problem

**At the lunar south pole, one degree of horizon decides whether a lander lives.**

- The Sun never rises more than **~2°**, so it skims the horizon for 29.5 days.
- Earth sits *on* the horizon and wobbles in and out of view, so radio contact comes and goes.
- When a launch slips, planners must re-check every site and date across several expert tools.

**Visual:** the "56% vs 0%" figure: Connecting Ridge vs the Shackleton crater floor, 15 km apart.

---

## 3 · What AS75 Lab does

**From site and date to a go/no-go answer, with the reason, in seconds.**

- **Horizon view:** the real LOLA terrain skyline, plus the Sun's and Earth's paths through the mission
- **Telemetry:** next loss of sun, sustained sunset and next Earthset
- **Verdict with a reason:** *Fails: 2 d 22 h night > 50 h battery* · *Needs relay: Earth never in view*
- **Compare 3 scenarios**, with one-click launch slips
- **Click anywhere** on the pole for a live terrain horizon

**Visual:** the Plan tab with the scenario strip (Viable / Fails / Needs relay).

---

## 4 · The launch-slip question, answered

**"We slipped two weeks. Are we still alive, and where?"**

- **Malapert, 16 Aug 2027: Viable**. 100% sunlight and 100% Earth link.
- **Same site, +14 days: Fails**. A 70-hour night outlasts the 50-hour battery.
- **Slater Plain, +14 days: Needs relay**. Full sun, but Earth is below the horizon the whole time.
- The **date sweep** scores every landing day for 18 months and shows the next safe window.

**Visual:** the date sweep with "Highlight viable days" on, and the detail panel.

---

## 5 · How it works

- **NASA SPICE / DE440** Sun and Earth vectors in the MOON_ME frame (the LOLA frame)
- **LRO LOLA** elevation: 40 m near the site, 240 m to 200 km. Horizons are ray-traced at 720 azimuths with exact curvature.
- **Fully static web app:** all the geometry runs in your browser, so there is no server and it works on a phone
- **Hard gates first** (battery, comm blackout), then a weighted score

**Visual:** a simple pipeline diagram: SPICE + LOLA → Python pipeline → static data → browser engine → views.

---

## 6 · Checked against reality

| Check | Result |
|---|---|
| vs JPL Horizons | **0.0001°** |
| vs NASA PGDA sunlight map (300 points) | **r = 0.993** |
| vs NASA PGDA Earth-visibility map | **r = 0.995** |
| Permanent shadows found by both | **47 / 47** |
| Apollo 11 Sun at touchdown | **10.7°** (NASA 10.8°) |
| Chandrayaan-3 sunset | **4 Sep 2023**, the day Vikram was put to sleep |

**Visual:** the two scatter plots from "07 Checked against reality".

---

## 7 · Impact and next steps

**For planners:** minutes instead of hours when schedules change.
**For teams:** one shared picture of the trade-off between science targets and survivable terrain.
**For everyone:** the "Why it's hard" explainer turns lunar engineering into numbers anyone can feel.

**Next:** 5 m terrain for landing ellipses · thermal model · relay satellite coverage · export to mission planning tools

**Visual:** the "Why it's hard" hero title.
