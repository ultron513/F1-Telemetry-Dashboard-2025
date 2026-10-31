<div align="center">

# Pit Wall

### An interactive Formula 1 telemetry, strategy and race-control dashboard

Every session from 2023 to 2026 · built on FastF1, FastAPI and Next.js · re-themes itself in the colours of the team you're watching

[![CI](https://github.com/ultron513/F1-Telemetry-Dashboard-2025/actions/workflows/ci.yml/badge.svg)](https://github.com/ultron513/F1-Telemetry-Dashboard-2025/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688?logo=fastapi&logoColor=white)
![FastF1](https://img.shields.io/badge/FastF1-3.9-E10600)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

<img src="docs/screenshots/team-themes.gif" alt="The session hero switching between Red Bull, McLaren, Ferrari, Mercedes, Aston Martin, Williams, Alpine, Racing Bulls, Haas and Sauber colours as the focused driver changes" width="900">

<sub>Pick a driver and the whole dashboard cross-fades into their team's colours.</sub>

[**Tour**](#-take-the-tour) · [**How it works**](#-how-it-works) · [**The analytics**](#-the-analytics-explained) · [**API**](#-api-reference) · [**Run it**](#-run-it-locally) · [**Deploy**](#-deploy) · [**Project layout**](#-project-layout)

</div>

---

## 🏁 At a glance

| | |
| --- | --- |
| **Seasons** | 2023, 2024, 2025, 2026 — every practice, sprint, qualifying and race session |
| **Pages** | Overview · Telemetry · Lap analysis · Track map · Strategy · Head to head · Race control · Weather · Standings · Drivers · Settings |
| **Charts** | All hand-built in SVG: stacked telemetry traces with synced crosshair and zoom, circuit maps, tyre-strategy Gantt, race trace, box plots, radar, wind rose |
| **Live feel** | A session replay with every car on the map, a timing tower, Safety Car / VSC / red-flag banners and race-control messages arriving as notifications |
| **Shareable** | Season, round, session, drivers and laps live in the URL — every view can be bookmarked |
| **Themes** | 15 team themes (2023–2026 constructors) · dark and light mode · km/h or mph · °C or °F |

---

## 🗺 Take the tour

Click any section to open it.

<details open>
<summary><b>Overview</b> — the result, the focus driver and the season so far</summary>
<br>

<img src="docs/screenshots/overview.png" alt="Overview page for the 2025 Japanese Grand Prix in Red Bull colours" width="100%">

- The event name sits on a livery band in the focused team's colours, with the circuit outline beside it.
- The classification is a timing tower — **click any row** to focus that driver and re-theme every page.
- The side panels show the focused driver's result, best and ideal laps, consistency and stints, plus the championship after this round.
- The season calendar along the bottom jumps between rounds.

</details>

<details open>
<summary><b>Telemetry</b> — every channel the car logged, overlaid and synced to the map</summary>
<br>

<img src="docs/screenshots/telemetry.png" alt="Telemetry page comparing Verstappen and Norris with the crosshair partway round the lap" width="100%">

- Speed, throttle, brake, gear, RPM and DRS stacked on one distance axis, with a **gap trace** on top showing who is ahead at every metre.
- **Hover** to read every channel at that point — the cars move round the track map in step. **Drag** across the traces to zoom into a corner; double-click to reset.
- The map can be coloured by speed, gear, pedal use or **who was faster in each of 25 mini-sectors**.
- Corner apex speeds with gears, the heaviest braking zones (entry speed, minimum speed, g-force) and short engineer's notes.
- Export the lap as **CSV** or the traces as **PNG**.

</details>

<details>
<summary><b>Race control replay</b> — watch the session back with live alerts</summary>
<br>

<img src="docs/screenshots/replay.gif" alt="Replay of the 2025 Australian Grand Prix under the Safety Car, cars bunching up on the map while the timing tower updates" width="100%">

- Every car moves round the circuit on the racing line, sampled once a second and interpolated in between.
- The timing tower updates live: gap to leader, interval, current tyre, **PIT** and **OUT** markers.
- A banner and a coloured border show Green, Yellow, **Safety Car**, **VSC** and **Red Flag** periods; the scrubber is shaded where they happened.
- Race-control messages pop up as notifications as the clock passes them and collect in the bell menu. Choose which severities alert you in Settings.
- Play at 1×, 4×, 10×, 30× or 60×, jump a lap at a time, or press <kbd>Space</kbd> to play/pause.

<img src="docs/screenshots/race-control-log.png" alt="Race control message log with flag chips, filters and the track-status timeline" width="100%">

The **Message log** tab has every message grouped by lap with flag chips, filters by type and a track-status timeline across the whole session.

</details>

<details>
<summary><b>Strategy</b> — tyres, pit stops, degradation and the race trace</summary>
<br>

<img src="docs/screenshots/strategy.png" alt="Strategy page with the tyre strategy chart, pit wall review, degradation chart, pit stop times and race trace" width="100%">

- One row per driver, each stint coloured by compound; used sets are hatched and SC/VSC laps are shaded.
- **Pit wall review**: each stint is checked against a degradation model using the pit loss measured from that race's in and out laps.
- Lap time against tyre age per stint, raw or fuel-corrected, with fitted lines and wear in ms per lap.
- Pit-lane times for every stop, and a race trace by position or gap to the leader.

</details>

<details>
<summary><b>Lap analysis</b> — the timing screen</summary>
<br>

<img src="docs/screenshots/laps.png" alt="Lap analysis for Leclerc against Hamilton in Ferrari colours" width="100%">

- Every lap with sectors in timing-screen colours: **purple** for the session best, **green** for a personal best.
- Lap times coloured by tyre, with the comparison driver drawn as a line, pit laps marked and SC/VSC laps shaded.
- Best, ideal (sum of best sectors), median, average and consistency.
- A field-pace box plot of every driver's clean green-flag laps.

</details>

<details>
<summary><b>Track map</b> — the lap drawn on the circuit</summary>
<br>

<img src="docs/screenshots/track-map.png" alt="Track map of Melbourne showing where Norris and Piastri were each faster" width="100%">

Colour the lap by speed, gear, pedal use, mini-sector dominance or DRS zones; read the circuit's length, sector lengths and corner apex speeds. Hover a corner in the list to find it on the map.

</details>

<details>
<summary><b>Head to head</b> — data-driven driver ratings</summary>
<br>

<img src="docs/screenshots/head-to-head.png" alt="Head to head between Russell and Antonelli with a radar chart and metric bars" width="100%">

Every driver in the session is scored from 60 to 99 on one-lap pace, long-run pace, consistency, straight-line speed, tyre management and racecraft, then two drivers are compared on a radar, metric by metric, and on their best laps. *Alt-click* a driver in the leaderboard to make them the rival.

</details>

<details>
<summary><b>Weather</b>, <b>Standings</b>, <b>Drivers</b> and <b>Settings</b></summary>
<br>

<img src="docs/screenshots/weather.png" alt="Weather page for a wet Australian Grand Prix with rain periods shaded" width="100%">

Track and air temperature, humidity, wind and pressure through the session, rain periods shaded, and a wind rose.

<img src="docs/screenshots/standings.png" alt="Championship standings with points progression" width="100%">

Drivers' and constructors' tables, points progression round by round, latest or after the selected round.

<img src="docs/screenshots/drivers.png" alt="The grid, team by team, with generated driver cards in team colours" width="100%">

The grid team by team. Each driver has a photo slot — see [Driver photos](#driver-photos).

<img src="docs/screenshots/settings.png" alt="Settings page" width="100%">

Units, dark/light mode, team theming (follow the focused driver, lock to one team, or neutral), replay alerts and API status.

</details>

<details>
<summary><b>Light mode</b> and <b>phones</b></summary>
<br>

<img src="docs/screenshots/light-mode.png" alt="Telemetry page in light mode" width="100%">

<p align="center"><img src="docs/screenshots/mobile.png" alt="Overview page on a phone" width="320"></p>

</details>

---

## ⚙ How it works

```mermaid
flowchart LR
    U([Browser]) -->|"static pages"| W["Next.js 16<br/>(Vercel)"]
    U -->|"JSON over HTTPS"| A["FastAPI<br/>/api/v1"]
    subgraph API ["Pit Wall API (Docker)"]
        A --> P["Payload memo<br/>LRU + TTL"]
        P --> S["Session store<br/>loaded sessions in RAM"]
        S --> F["FastF1"]
        A --> ST["Standings service"]
    end
    F <-->|"pickles"| C[("Disk cache<br/>/data/fastf1-cache")]
    F -->|"first load only"| LT["F1 live-timing archive"]
    ST --> J["Jolpica (Ergast) API"]
    ST -. "fallback" .-> S
```

<details>
<summary><b>What happens on a request</b></summary>
<br>

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant A as API route
    participant M as Payload memo
    participant S as Session store
    participant F as FastF1
    B->>A: GET /sessions/2025/3/R/telemetry?driver=VER
    A->>M: telemetry(ref, "VER", "fastest")
    alt payload cached
        M-->>A: JSON payload (instant)
    else first time for these arguments
        M->>S: get(2025, 3, "R")
        alt session already in memory
            S-->>M: Session
        else not loaded yet
            S->>F: get_session().load()  (one load per session, lock-guarded)
            F-->>S: Session (~3 s from disk, 30–90 s from the archive)
        end
        M->>M: resample to a 5 m grid, stats, braking zones, corners
        M-->>A: JSON payload (memoised)
    end
    A-->>B: 200 OK (gzip)
```

- Each session is loaded **once** and shared by every endpoint; concurrent requests for the same session wait on one lock instead of loading it twice.
- Derived payloads are memoised per argument tuple, so revisiting any view is instant.
- Errors come back as `{ "error": { "code", "message", "hint" } }` with proper 404 / 422 / 503 status codes, and the UI shows the message and hint.

</details>

<details>
<summary><b>Frontend architecture</b></summary>
<br>

```mermaid
flowchart TB
    URL["URL ?season&round&session&driver&vs&lap"] <--> SEL["SelectionProvider"]
    SEL --> TQ["TanStack Query hooks<br/>lib/api/queries.ts"]
    SEL --> TH["TeamThemeProvider<br/>CSS @property variables"]
    PREF["PreferencesProvider<br/>units · theming · alerts"] --> TH
    TQ --> PAGES["Pages"]
    TH --> PAGES
    PAGES --> CH["Custom SVG charts<br/>TraceStack · TrackMap · StrategyGantt · LineChart"]
    HOVER(["hoverDistance store"]) <--> CH
    REPLAY["Replay player"] --> NOTE(["Notification store"]) --> TOAST["Toasts + bell"]
```

- **Selection** lives in the URL; missing values resolve to the latest completed race, its winner and runner-up.
- **Team themes** are pushed into CSS custom properties registered with `@property`, so a team change animates instead of snapping. Only colours and abstract livery stripes are used — no logos.
- **Charts** are written from scratch in SVG (scales, ticks, paths, tooltips). The telemetry traces and the track map share a tiny external store for the hovered distance, so hovering doesn't re-render the page.

</details>

---

## 🧮 The analytics, explained

<details>
<summary><b>Lap delta and mini-sectors</b></summary>
<br>

Both laps are resampled onto the same 5 m distance grid (the second lap is mapped by *relative* distance, because recorded lap lengths differ by a few metres). Each driver's clock is stretched so the lap spans exactly the official lap time, which removes the drift from car-data sampling. The gap at distance $d$ is

$$\Delta(d) = t_B(d) - t_A(d)$$

so a positive value means driver A is ahead. The lap is then cut into 25 equal mini-sectors and each is awarded to whoever covered it faster.

</details>

<details>
<summary><b>Fuel-corrected tyre degradation</b></summary>
<br>

Only representative laps are used: timed, no in/out laps, no SC/VSC/red-flag laps, not deleted, and within 107% of the driver's best. Burning fuel makes the car roughly 0.035 s/lap faster, which hides tyre wear, so lap times are corrected before fitting a line against tyre age:

$$t^{\text{corr}}_i = t_i + 0.035 \cdot (\text{lap}_i - \text{lap}_0)$$

The slope of that line is the wear rate $k$ in seconds per lap of tyre age.

</details>

<details>
<summary><b>Pit loss and the optimal stint</b></summary>
<br>

Pit loss $P$ is measured from the race itself: the in-lap plus the out-lap minus two of that driver's median clean laps, taken as the median over all green-flag stops.

With linear wear, a stint of $n$ laps costs $\tfrac{k n^2}{2}$ in tyre loss plus one stop. Minimising the time lost per lap, $\tfrac{P}{n} + \tfrac{k n}{2}$, gives

$$n^* = \sqrt{\frac{2P}{k}}$$

Each stint is then labelled *on target*, *ran long*, *stopped early*, *tyres not limiting* or *no measurable wear*. It is a model, not the team's call — undercuts, traffic and the two-compound rule all matter.

</details>

<details>
<summary><b>Driver ratings (60–99)</b></summary>
<br>

| Metric | Measured as | Better |
| --- | --- | --- |
| One-lap pace | Best lap vs session best (%) | Lower |
| Long-run pace | Median clean lap vs the best median (%) | Lower |
| Consistency | Interquartile range of clean laps (s) | Lower |
| Straight-line speed | Highest speed-trap reading | Higher |
| Tyre management | Mean fuel-corrected wear across stints | Lower |
| Racecraft | Places gained from lap 1 to the flag (finishers only) | Higher |

Each metric is mapped linearly from the worst driver (60) to the best (99) in that session, then weighted by session type (races weight long-run pace and tyres; qualifying weights one-lap pace and top speed). Drivers with too few representative laps get no overall rating instead of an extreme one.

</details>

<details>
<summary><b>Session replay</b></summary>
<br>

Streaming raw X/Y positions for 20 cars would be large, and straight-line interpolation cuts corners. Instead, each car's position is sent as **progress**: completed laps plus the fraction of the current lap, measured by integrated distance between that lap's start and end timestamps. The browser maps the fraction back onto the circuit outline, so cars always follow the racing line. Gaps are the time since the race leader passed the same point.

</details>

---

## 🔌 API reference

Interactive docs live at **`/docs`** (Swagger) once the API is running.

<details>
<summary><b>Endpoints</b></summary>
<br>

**Calendar and championship**

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/v1/health` | Status, version, sessions loaded in memory |
| GET | `/api/v1/seasons` | Supported seasons and the default |
| GET | `/api/v1/seasons/{season}/events` | Calendar with sessions and status, next and last events |
| GET | `/api/v1/seasons/{season}/events/{round}` | One event |
| GET | `/api/v1/seasons/{season}/standings?round=` | Driver and constructor standings with points progression |

**Session** — prefix `/api/v1/sessions/{season}/{round}/{session}`, where `session` is one of `FP1 FP2 FP3 Q SQ SS S R`

| Path | Query | Returns |
| --- | --- | --- |
| `/summary` | | Event, drivers, classification, highlights, weather snapshot |
| `/drivers` | | Drivers with team and team colour |
| `/results` | | Classification |
| `/laps` | `driver` | Every lap with graded sectors, tyres, flags; stats and stints |
| `/pace` | | Clean-lap distribution for every driver |
| `/circuit` | | Outline, corners, sectors, DRS zones, rotation |
| `/telemetry` | `driver`, `lap` (number or `fastest`) | Distance-resampled channels, stats, braking zones, corners, insights |
| `/compare` | `driver_a`, `lap_a`, `driver_b`, `lap_b` | Both laps on one grid, delta, sector deltas, mini-sectors |
| `/strategy` | | Stints, pit stops, measured pit loss, compound wear |
| `/race-trace` | | Position and gap to leader per lap, track status per lap |
| `/degradation` | `driver` | Per-stint lap times vs tyre age with raw and fuel-corrected fits |
| `/recommendation` | `driver` | Pit-wall review of each stint |
| `/race-control` | | Classified messages, counts, track-status timeline |
| `/weather` | | Time series, summary, wind rose, rain periods |
| `/ratings` | | 60–99 ratings for every driver |
| `/replay` | `step` (s, default 1) | Every car's progress on a fixed clock, pits, stints |

</details>

<details>
<summary><b>Try it</b></summary>
<br>

```bash
# Winner, podium and highlights of the 2025 Japanese GP
curl "http://127.0.0.1:8000/api/v1/sessions/2025/3/R/summary"

# Verstappen's fastest lap against Norris's
curl "http://127.0.0.1:8000/api/v1/sessions/2025/3/R/compare?driver_a=VER&driver_b=NOR"

# Errors carry a hint
curl "http://127.0.0.1:8000/api/v1/sessions/2025/3/R/telemetry?driver=VER&lap=999"
# {"error":{"code":"not_found","message":"VER has no lap 999.","hint":"Laps 1–53 are available."}}
```

</details>

---

## 💻 Run it locally

Requires **Python 3.11+** and **Node 20.9+**. Open two terminals in the project folder.

<details open>
<summary><b>Windows (PowerShell)</b></summary>
<br>

```powershell
# Terminal 1 — API
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload        # http://127.0.0.1:8000/docs
```

```powershell
# Terminal 2 — web
cd frontend
npm install
npm run dev                          # http://localhost:3000
```

If activation is blocked, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

</details>

<details>
<summary><b>macOS / Linux</b></summary>
<br>

```bash
# Terminal 1 — API
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# Terminal 2 — web
cd frontend
npm install && npm run dev
```

</details>

<details>
<summary><b>Docker (both together)</b></summary>
<br>

```bash
docker compose up --build            # web on :3000, API on :8000
```

The FastF1 cache is mounted from `./cache`; make sure the container can write to it.

</details>

<details>
<summary><b>Tests and checks</b></summary>
<br>

```bash
cd backend && ruff check . && pytest              # runs offline against ./cache
cd frontend && npm run lint && npm run typecheck && npm run build
```

GitHub Actions runs all of these on every push and pull request.

</details>

> [!NOTE]
> The first time a session is opened, FastF1 downloads it from the F1 live-timing archive (30–90 s). After that it loads from `cache/` in a few seconds.

---

## 🚀 Deploy

```mermaid
flowchart LR
    GH["GitHub<br/>main"] -->|"auto deploy"| V["Vercel<br/>frontend/"]
    GH -->|"render.yaml"| R["Render<br/>backend/Dockerfile"]
    R --- D[("10 GB disk<br/>FastF1 cache")]
    V -->|"NEXT_PUBLIC_API_URL"| R
```

1. **API → Render.** New → Blueprint → pick this repo; `render.yaml` sets up the Docker service, health check and a persistent disk for the cache. Use at least the **Starter** plan — a loaded race needs a few hundred MB of RAM. Set `CORS_ORIGINS` to your Vercel URL. (Railway, Fly.io and Hugging Face Spaces work too with `backend/Dockerfile`; mount a volume at `/data/fastf1-cache`.)
2. **Web → Vercel.** Import the repo, set **Root Directory** to `frontend`, add `NEXT_PUBLIC_API_URL=https://<your-api-host>`, deploy. Every page is statically prerendered and calls the API from the browser.

<details>
<summary><b>Backend environment variables</b></summary>
<br>

| Variable | Default | Purpose |
| --- | --- | --- |
| `F1_CACHE_DIR` | `../cache` | FastF1 on-disk cache |
| `F1_SESSION_CACHE_SIZE` | `3` | Fully loaded sessions kept in memory |
| `F1_SEASONS` | `2023,2024,2025,2026` | Seasons the API exposes |
| `F1_DEFAULT_SEASON` | `2025` | Season the dashboard opens on |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins (comma separated) |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Extra allowed origins (Vercel previews) |
| `F1_OFFLINE` | `0` | Serve cached sessions only, never hit the network |
| `JOLPICA_BASE_URL` | `https://api.jolpi.ca/ergast/f1` | Standings source |

</details>

---

## 📁 Project layout

<details>
<summary><b>Show the tree</b></summary>
<br>

```
.
├── backend/                     FastAPI + FastF1
│   ├── app/
│   │   ├── core/                settings, errors, memoisation, FastF1 setup
│   │   ├── data/                season calendars, in-memory session store
│   │   ├── services/            results · laps · telemetry · circuit · strategy
│   │   │                        race_control · weather · ratings · replay · standings
│   │   ├── schemas/             Pydantic response models
│   │   ├── api/                 v1 routers, request deps, memoised payload layer
│   │   └── main.py              app factory (CORS, gzip, error handlers)
│   ├── tests/                   pytest suite (offline, against ../cache)
│   └── Dockerfile
├── frontend/                    Next.js 16 · Tailwind 4 · TanStack Query
│   ├── app/                     one folder per page
│   ├── components/
│   │   ├── charts/              TraceStack, TrackMap, StrategyGantt, LineChart, radar, wind rose
│   │   ├── replay/              session replay player
│   │   ├── shell/               layout, pickers, notifications
│   │   ├── session/             hero, classification, season widgets
│   │   ├── f1/                  tyres, flags, timing cells, driver avatars
│   │   └── ui/                  panel, picker, primitives
│   ├── lib/                     API client and hooks, team registry, formatting
│   ├── state/                   URL selection, preferences, theme, notifications
│   └── public/drivers/          optional driver photos + manifest.json
├── cache/                       FastF1 cache (two 2025 races included for offline tests)
├── docs/                        architecture notes and README screenshots
├── notebooks/, src/             original exploration notebooks and helpers
├── render.yaml                  Render blueprint for the API
└── docker-compose.yml           full stack locally
```

</details>

### Driver photos

Photos are opt-in. Add images you have the rights to use to `frontend/public/drivers/` and map driver codes to files in `frontend/public/drivers/manifest.json`:

```json
{ "VER": "VER.webp", "NOR": "NOR.webp" }
```

Drivers without a photo get a generated card in their team's colours with their race number.

---

## 🛣 Roadmap

- [x] Multi-season API with in-memory session store and memoised payloads
- [x] Telemetry overlay, gap trace, mini-sectors, corner and braking analysis
- [x] Tyre strategy, measured pit loss, fuel-corrected degradation, stint review
- [x] Session replay with live race-control notifications
- [x] Team theming for every 2023–2026 constructor, dark/light mode
- [x] Docker, Render and Vercel configs, CI
- [ ] Qualifying knockout view (Q1/Q2/Q3 cut-off lines)
- [ ] More than two drivers on the telemetry overlay
- [ ] Season-long driver form pages
- [ ] Live sessions via FastF1's live-timing client

---

<div align="center">
<sub>Timing data via <a href="https://docs.fastf1.dev">FastF1</a> and <a href="https://github.com/jolpica/jolpica-f1">Jolpica</a>. Not affiliated with Formula 1, the FIA or any team. Built by Asish Kumar Patra.</sub>
</div>
