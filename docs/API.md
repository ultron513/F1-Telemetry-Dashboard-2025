# Pit Wall API reference

> Generated from the OpenAPI schema by `backend/scripts/gen_api_docs.py`; do not edit by hand.
> Interactive docs: `http://localhost:8000/docs`. Machine-readable: [`openapi.json`](openapi.json).

**Version 2.0.0.** All paths are under `/api/v1`. Errors are `{"error": {"code", "message", "hint"}}` with a matching HTTP status. Session paths take `{season}` (2018+), `{round}` and `{session}` (`FP1`, `FP2`, `FP3`, `SQ`, `S`, `Q`, `R`).

A typed Python client lives in [`sdk/python`](../sdk/python).

## Contents

- [Meta](#meta) (3)
- [Calendar & Championship](#calendar--championship) (4)
- [Session](#session) (3)
- [Laps](#laps) (2)
- [Telemetry](#telemetry) (2)
- [Circuit](#circuit) (2)
- [Strategy](#strategy) (4)
- [Simulator](#simulator) (4)
- [Analysis](#analysis) (4)
- [Race Control](#race-control) (1)
- [Weather](#weather) (1)
- [Performance](#performance) (1)
- [Replay](#replay) (2)
- [Live](#live) (1)
- [History](#history) (5)
- [Operations](#operations) (4)

## Meta

### `GET /api/v1/health`

Liveness probe.

### `GET /api/v1/seasons`

Supported seasons.

Returns: `SeasonsResponse`

### `GET /api/v1/warehouse`

Sessions in the season warehouse.

## Calendar & Championship

### `GET /api/v1/seasons/{season}/events`

Season calendar.

Returns: `EventsResponse`

### `GET /api/v1/seasons/{season}/events/{round}`

Single event.

Returns: `Event`

### `GET /api/v1/seasons/{season}/standings`

Driver & constructor standings with points progression.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `round` | query | `integer | null` | no | Standings after this round |

Returns: `StandingsResponse`

### `GET /api/v1/seasons/{season}/teammates`

Team-mate head-to-head across the season (from the warehouse).

Returns: `TeammateBattleResponse`

## Session

### `GET /api/v1/sessions/{season}/{round}/{session}/drivers`

Drivers.

Returns: `app__schemas__session__DriversResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/results`

Results.

Returns: `ResultsResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/summary`

Summary.

Returns: `SessionSummary`

## Laps

### `GET /api/v1/sessions/{season}/{round}/{session}/laps`

Laps.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |

Returns: `LapTableResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/pace`

Pace.

Returns: `FieldPaceResponse`

## Telemetry

### `GET /api/v1/sessions/{season}/{round}/{session}/compare`

Compare.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver_a` | query | `string` | yes | Three-letter driver code |
| `driver_b` | query | `string` | yes | Three-letter driver code |
| `lap_a` | query | `string | null` | no | Lap number or 'fastest' |
| `lap_b` | query | `string | null` | no | Lap number or 'fastest' |

Returns: `CompareResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/telemetry`

Telemetry.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |
| `lap` | query | `string | null` | no | Lap number or 'fastest' |

Returns: `TelemetryResponse`

## Circuit

### `GET /api/v1/sessions/{season}/{round}/{session}/circuit`

Circuit.

Returns: `CircuitResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/circuit/3d`

Track outline with elevation (metres).

## Strategy

### `GET /api/v1/sessions/{season}/{round}/{session}/degradation`

Degradation.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |

Returns: `DegradationResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/race-trace`

Race Trace.

Returns: `RaceTraceResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/recommendation`

Recommendation.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |

Returns: `RecommendationResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/strategy`

Strategy.

Returns: `StrategyResponse`

## Simulator

### `GET /api/v1/sessions/{season}/{round}/{session}/simulator/model`

Simulator Model.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string | null` | no |  |

Returns: `SimulatorModelResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/simulator/optimise`

Simulator Optimise.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |
| `conditions` | query | `string` | no |  (default `green`) |

Returns: `OptimiseResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/simulator/simulate`

Simulator Simulate.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |
| `plan` | query | `string` | yes | Stints as COMPOUND:LAPS[:AGE], comma separated, e.g. M:20,H:33 |
| `runs` | query | `integer` | no |  (default `400`) |
| `sc` | query | `number | null` | no | Expected safety cars |
| `vsc` | query | `number | null` | no | Expected VSCs |

Returns: `SimulationResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/simulator/undercut`

Simulator Undercut.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `attacker` | query | `string` | yes | Three-letter driver code |
| `defender` | query | `string` | yes | Three-letter driver code |
| `lap` | query | `integer` | yes |  |
| `compound` | query | `string | null` | no |  |

Returns: `UndercutResponse`

## Analysis

### `GET /api/v1/sessions/{season}/{round}/{session}/analysis/cars`

Analysis Cars.

Returns: `CarsResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/analysis/ideal-lap`

Analysis Ideal Lap.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |

Returns: `IdealLapResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/analysis/style`

Analysis Style.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `drivers` | query | `string` | yes | One or two driver codes, comma separated |

Returns: `StyleResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/analysis/tyre-management`

Analysis Tyre Management.

Returns: `TyreManagementResponse`

## Race Control

### `GET /api/v1/sessions/{season}/{round}/{session}/race-control`

Race Control.

Returns: `RaceControlResponse`

## Weather

### `GET /api/v1/sessions/{season}/{round}/{session}/weather`

Weather.

Returns: `WeatherResponse`

## Performance

### `GET /api/v1/sessions/{season}/{round}/{session}/ratings`

Ratings.

Returns: `RatingsResponse`

## Replay

### `GET /api/v1/sessions/{season}/{round}/{session}/replay`

Replay.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `step` | query | `number` | no | Seconds between frames (default `1.0`) |

Returns: `ReplayResponse`

### `GET /api/v1/sessions/{season}/{round}/{session}/replay/onboard`

One car's dashboard channels on the replay clock.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `driver` | query | `string` | yes | Three-letter driver code |
| `step` | query | `number` | no |  (default `0.5`) |

## Live

### `GET /api/v1/live/status`

Is a session live right now?.

## History

### `GET /api/v1/history/champions`

Every world champion since 1950.

Returns: `ChampionsResponse`

### `GET /api/v1/history/circuits`

Every circuit used since 1950.

Returns: `CircuitsResponse`

### `GET /api/v1/history/circuits/{circuit_id}`

Winners, poles and pole-time evolution at a circuit.

Returns: `CircuitHistoryResponse`

### `GET /api/v1/history/drivers`

Every driver who started a championship race.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `search` | query | `string` | no |  (default ``) |

Returns: `app__schemas__history__DriversResponse`

### `GET /api/v1/history/drivers/{driver_id}`

A driver's career.

Returns: `CareerResponse`

## Operations

### `GET /api/v1/jobs`

Recent background jobs.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | `integer` | no |  (default `30`) |

### `POST /api/v1/jobs/ingest`

Queue sessions for download, warehouse ingest and warm-up.

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `x-admin-token` | header | `string | null` | no |  |

Body: `IngestRequest` (JSON)

### `GET /api/v1/jobs/{job_id}`

One background job.

### `GET /api/v1/status`

Service status for the public status page.

## WebSocket: live timing

`GET /api/v1/live/ws` (WebSocket). `?mode=live` streams the real F1 feed during a session; `?mode=archive&season=2025&round=3&session=R&speed=20&start=0` replays a finished session as if live. The server sends `hello`, then a `snapshot` about once a second (timing tower, pit windows, win probabilities, race control, `alerts`), and `end` when a replay finishes. Send `{"speed": 60}`, `{"paused": true}` or `{"seek": 1800}` to control a replay.
