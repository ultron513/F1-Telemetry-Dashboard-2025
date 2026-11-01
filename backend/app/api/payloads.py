"""Application layer: memoised, session-scoped payload builders.

Routers call these with plain hashable arguments; each function resolves
the loaded session from the store and delegates to a domain service.
Results are cached per argument tuple so repeated views are instant.
"""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.core.errors import InvalidParameterError
from app.core.memo import memoize
from app.data.schedule import SessionRef
from app.data.session_store import store
from app.services import (
    circuit as circuit_svc,
    common,
    laps as laps_svc,
    race_control as rc_svc,
    ratings as ratings_svc,
    replay as replay_svc,
    results as results_svc,
    simulator as sim_svc,
    strategy as strategy_svc,
    telemetry as telemetry_svc,
    weather as weather_svc,
)

SIZE = settings.payload_cache_size
TTL = settings.payload_cache_ttl


def _ctx(ref: SessionRef) -> dict[str, Any]:
    return {
        "season": ref.season,
        "round": ref.round,
        "session": {"code": ref.code, "name": ref.name, "kind": ref.kind},
    }


@memoize(SIZE, TTL)
def summary(ref: SessionRef) -> dict[str, Any]:
    return results_svc.summary(ref, store.get(ref))


@memoize(SIZE, TTL)
def drivers(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), "drivers": common.drivers(store.get(ref))}


@memoize(SIZE, TTL)
def results(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), "results": results_svc.classification(ref, store.get(ref))}


@memoize(SIZE, TTL)
def lap_table(ref: SessionRef, driver: str) -> dict[str, Any]:
    return {**_ctx(ref), **laps_svc.driver_lap_table(store.get(ref), driver)}


@memoize(SIZE, TTL)
def field_pace(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **laps_svc.field_pace(store.get(ref))}


@memoize(SIZE, TTL)
def circuit(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **circuit_svc.circuit(store.get(ref))}


@memoize(SIZE, TTL)
def telemetry(ref: SessionRef, driver: str, lap: str) -> dict[str, Any]:
    track = circuit(ref)
    return {
        **_ctx(ref),
        **telemetry_svc.lap_telemetry(
            store.get(ref), driver, lap, track["corners"], track["length"]
        ),
    }


@memoize(SIZE, TTL)
def compare(ref: SessionRef, a: str, lap_a: str, b: str, lap_b: str) -> dict[str, Any]:
    return {**_ctx(ref), **telemetry_svc.compare(store.get(ref), a, lap_a, b, lap_b)}


@memoize(SIZE, TTL)
def strategy(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **strategy_svc.strategy(store.get(ref))}


@memoize(SIZE, TTL)
def race_trace(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **strategy_svc.race_trace(store.get(ref))}


@memoize(SIZE, TTL)
def degradation(ref: SessionRef, driver: str) -> dict[str, Any]:
    return {**_ctx(ref), **strategy_svc.degradation(store.get(ref), driver)}


@memoize(SIZE, TTL)
def recommendation(ref: SessionRef, driver: str) -> dict[str, Any]:
    return {**_ctx(ref), **strategy_svc.recommendation(store.get(ref), driver)}


@memoize(SIZE, TTL)
def race_control(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **rc_svc.race_control(store.get(ref))}


@memoize(SIZE, TTL)
def weather(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **weather_svc.weather(store.get(ref))}


@memoize(SIZE, TTL)
def ratings(ref: SessionRef) -> dict[str, Any]:
    return {**_ctx(ref), **ratings_svc.ratings(ref, store.get(ref))}


@memoize(64, TTL)
def replay(ref: SessionRef, step: float) -> dict[str, Any]:
    return {**_ctx(ref), **replay_svc.replay(store.get(ref), step)}


# --- Strategy simulator -------------------------------------------------------


def _require_race(ref: SessionRef) -> None:
    if ref.kind != "race":
        raise InvalidParameterError(
            "The strategy simulator works on races and sprints.",
            hint="Choose the Race or Sprint session.",
        )


@memoize(64, TTL)
def sim_model(ref: SessionRef) -> sim_svc.TyreModel:
    _require_race(ref)
    return sim_svc.fit(store.get(ref))


@memoize(SIZE, TTL)
def sim_describe(ref: SessionRef, driver: str | None) -> dict[str, Any]:
    return {**_ctx(ref), **sim_svc.describe(sim_model(ref), driver)}


@memoize(SIZE, TTL)
def sim_run(
    ref: SessionRef, driver: str, plan: str, runs: int, sc: float | None, vsc: float | None
) -> dict[str, Any]:
    return {**_ctx(ref), **sim_svc.simulate(sim_model(ref), driver, plan, runs, sc, vsc)}


@memoize(SIZE, TTL)
def sim_optimise(ref: SessionRef, driver: str, conditions: str) -> dict[str, Any]:
    return {**_ctx(ref), **sim_svc.optimise(sim_model(ref), driver, conditions)}


@memoize(SIZE, TTL)
def sim_undercut(
    ref: SessionRef, attacker: str, defender: str, lap: int, compound: str | None
) -> dict[str, Any]:
    return {
        **_ctx(ref),
        **sim_svc.undercut(store.get(ref), sim_model(ref), attacker, defender, lap, compound),
    }
