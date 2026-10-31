# PRODUCT ROADMAP

Status as of the v2 rebuild.

## Done

- **Backend platform** — multi-season FastAPI service, in-memory session store, memoised payloads, structured errors, tests, Docker image
- **Telemetry analytics** — speed, throttle, brake, gear, RPM, DRS, braking zones, corner apex speeds, lap overlay with delta, mini-sector dominance
- **Race analytics** — tyre strategy, pit-lane times, measured pit loss, fuel-corrected degradation, stint review model, race trace, position changes
- **Championship analytics** — driver and constructor standings, wins, podiums, points progression (Jolpica, with a FastF1 fallback)
- **Circuit analytics** — interactive map (speed / gear / pedals / dominance / DRS zones), corners, sectors
- **Weather analytics** — temperatures, humidity, wind, pressure, rain periods, wind rose
- **Dashboard** — overview, telemetry, laps, track map, strategy, head to head, race control (replay + log), weather, standings, drivers, settings; team theming; notifications
- **Deployment** — Vercel (web) + Render/Docker (API) configs, CI workflow

## Next ideas

- Qualifying segment view (Q1/Q2/Q3 knockouts with cut-off lines)
- Multi-lap telemetry overlays (more than two drivers)
- Season-wide driver profile pages (form across rounds)
- Live session mode via FastF1's live-timing client
