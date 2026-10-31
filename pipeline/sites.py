"""Curated site catalogue. lat/lon are planetocentric degrees, east-positive (MOON_ME).

`approx=True` marks points we placed ourselves (e.g. inside an Artemis III candidate
region, whose exact centres NASA has not published); the UI labels them as such.
"""

RAW_SITES = [
    # --- South-pole: Artemis III candidate regions (approximate points) ---
    dict(id="malapert", name="Malapert Massif", group="Artemis III region",
         lat=-85.99, lon=-0.5, approx=True),
    dict(id="mons-mouton", name="Mons Mouton", group="Artemis III region",
         lat=-84.6, lon=31.0, approx=True),
    dict(id="haworth", name="Haworth", group="Artemis III region",
         lat=-87.0, lon=-10.0, approx=True),
    dict(id="nobile-rim", name="Nobile Rim", group="Artemis III region",
         lat=-85.2, lon=40.0, approx=True),
    dict(id="de-gerlache-rim", name="de Gerlache Rim", group="Artemis III region",
         lat=-88.1, lon=-68.0, approx=True),
    dict(id="slater-plain", name="Slater Plain", group="Artemis III region",
         lat=-87.6, lon=112.0, approx=True),
    dict(id="connecting-ridge", name="Connecting Ridge", group="South pole (earlier candidate)",
         lat=-89.53432, lon=209.94767, approx=False,
         note="Site from LPSC 2024 abstract; region dropped from the 2024 Artemis III list"),
    dict(id="shackleton", name="Shackleton crater floor", group="South pole",
         lat=-89.67, lon=129.78, approx=True,
         note="Permanently shadowed crater floor: shows the extreme case"),

    # --- Robotic landings near the south pole ---
    dict(id="im2", name="IM-2 Athena (2025)", group="Commercial (CLPS)",
         lat=-84.7906, lon=29.1957, date="2025-03-06T17:28:00Z"),
    dict(id="im1", name="IM-1 Odysseus (2024)", group="Commercial (CLPS)",
         lat=-80.13, lon=1.44, date="2024-02-22T23:23:00Z"),
    dict(id="ch3", name="Chandrayaan-3 Vikram (2023)", group="India (ISRO)",
         lat=-69.373, lon=32.319, date="2023-08-23T12:33:00Z"),
    dict(id="luna25", name="Luna-25 target (2023)", group="Russia",
         lat=-69.545, lon=43.544, date="2023-08-21T00:00:00Z",
         note="Planned site; spacecraft crashed before landing"),

    # --- Elsewhere (contrast cases) ---
    dict(id="slim", name="SLIM (2024)", group="Japan (JAXA)",
         lat=-13.316, lon=25.251, date="2024-01-19T15:20:00Z"),
    dict(id="bg1", name="Blue Ghost M1 (2025)", group="Commercial (CLPS)",
         lat=18.56, lon=61.81, date="2025-03-02T08:34:00Z"),
    dict(id="ce4", name="Chang'e-4 (far side, 2019)", group="China (CNSA)",
         lat=-45.4446, lon=177.5991, date="2019-01-03T02:26:00Z",
         note="Far side: Earth is never above the horizon"),
    dict(id="ce6", name="Chang'e-6 (far side, 2024)", group="China (CNSA)",
         lat=-41.638, lon=-153.985, date="2024-06-01T22:23:00Z",
         note="Far side: Earth is never above the horizon"),
    dict(id="a11", name="Apollo 11", group="Apollo",
         lat=0.67408, lon=23.47297, date="1969-07-20T20:17:40Z"),
    dict(id="a12", name="Apollo 12", group="Apollo",
         lat=-3.01239, lon=-23.42157, date="1969-11-19T06:54:35Z"),
    dict(id="a14", name="Apollo 14", group="Apollo",
         lat=-3.64530, lon=-17.47136, date="1971-02-05T09:18:11Z"),
    dict(id="a15", name="Apollo 15", group="Apollo",
         lat=26.13222, lon=3.63386, date="1971-07-30T22:16:29Z"),
    dict(id="a16", name="Apollo 16", group="Apollo",
         lat=-8.97301, lon=15.50019, date="1972-04-21T02:23:35Z"),
    dict(id="a17", name="Apollo 17", group="Apollo",
         lat=20.19080, lon=30.77168, date="1972-12-11T19:54:57Z"),
]


def _apply_optimized(raw):
    """Replace approximate Artemis points with optimize_sites.py results, if present."""
    import copy
    import json
    from pathlib import Path

    path = Path(__file__).with_name("optimized_sites.json")
    best = json.loads(path.read_text()) if path.exists() else {}
    out = []
    for s in raw:
        s = copy.deepcopy(s)
        b = best.get(s["id"])
        if b:
            s.update(lat=b["lat"], lon=b["lon"], optimized=True,
                     note="Best-lit flat point (slope <= 8 deg) we found within 6 km of an "
                          "approximate point in this NASA candidate region")
        out.append(s)
    return out


SITES = _apply_optimized(RAW_SITES)
