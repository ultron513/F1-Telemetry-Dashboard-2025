from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api import payloads
from app.api.deps import norm_driver, norm_lap, session_ref
from app.data.schedule import SessionRef
from app.schemas.laps import FieldPaceResponse, LapTableResponse
from app.schemas.misc import (
    RaceControlResponse,
    RatingsResponse,
    ReplayResponse,
    WeatherResponse,
)
from app.schemas.session import DriversResponse, ResultsResponse, SessionSummary
from app.schemas.simulator import (
    OptimiseResponse,
    SimulationResponse,
    SimulatorModelResponse,
    UndercutResponse,
)
from app.schemas.strategy import (
    DegradationResponse,
    RaceTraceResponse,
    RecommendationResponse,
    StrategyResponse,
)
from app.schemas.telemetry import CircuitResponse, CompareResponse, TelemetryResponse

router = APIRouter(prefix="/sessions/{season}/{round}/{session}")

Ref = Annotated[SessionRef, Depends(session_ref)]
Driver = Annotated[str, Query(min_length=2, max_length=3, description="Three-letter driver code")]
LapParam = Annotated[str | None, Query(description="Lap number or 'fastest'")]


@router.get("/summary", response_model=SessionSummary, tags=["Session"])
def summary(ref: Ref) -> dict:
    return payloads.summary(ref)


@router.get("/drivers", response_model=DriversResponse, tags=["Session"])
def drivers(ref: Ref) -> dict:
    return payloads.drivers(ref)


@router.get("/results", response_model=ResultsResponse, tags=["Session"])
def results(ref: Ref) -> dict:
    return payloads.results(ref)


@router.get("/laps", response_model=LapTableResponse, tags=["Laps"])
def laps(ref: Ref, driver: Driver) -> dict:
    return payloads.lap_table(ref, norm_driver(driver))


@router.get("/pace", response_model=FieldPaceResponse, tags=["Laps"])
def pace(ref: Ref) -> dict:
    return payloads.field_pace(ref)


@router.get("/circuit", response_model=CircuitResponse, tags=["Circuit"])
def circuit(ref: Ref) -> dict:
    return payloads.circuit(ref)


@router.get("/telemetry", response_model=TelemetryResponse, tags=["Telemetry"])
def telemetry(ref: Ref, driver: Driver, lap: LapParam = None) -> dict:
    return payloads.telemetry(ref, norm_driver(driver), norm_lap(lap))


@router.get("/compare", response_model=CompareResponse, tags=["Telemetry"])
def compare(
    ref: Ref,
    driver_a: Driver,
    driver_b: Driver,
    lap_a: LapParam = None,
    lap_b: LapParam = None,
) -> dict:
    return payloads.compare(
        ref, norm_driver(driver_a), norm_lap(lap_a), norm_driver(driver_b), norm_lap(lap_b)
    )


@router.get("/strategy", response_model=StrategyResponse, tags=["Strategy"])
def strategy(ref: Ref) -> dict:
    return payloads.strategy(ref)


@router.get("/race-trace", response_model=RaceTraceResponse, tags=["Strategy"])
def race_trace(ref: Ref) -> dict:
    return payloads.race_trace(ref)


@router.get("/degradation", response_model=DegradationResponse, tags=["Strategy"])
def degradation(ref: Ref, driver: Driver) -> dict:
    return payloads.degradation(ref, norm_driver(driver))


@router.get("/recommendation", response_model=RecommendationResponse, tags=["Strategy"])
def recommendation(ref: Ref, driver: Driver) -> dict:
    return payloads.recommendation(ref, norm_driver(driver))


@router.get("/race-control", response_model=RaceControlResponse, tags=["Race Control"])
def race_control(ref: Ref) -> dict:
    return payloads.race_control(ref)


@router.get("/weather", response_model=WeatherResponse, tags=["Weather"])
def weather(ref: Ref) -> dict:
    return payloads.weather(ref)


@router.get("/ratings", response_model=RatingsResponse, tags=["Performance"])
def ratings(ref: Ref) -> dict:
    return payloads.ratings(ref)


@router.get("/replay", response_model=ReplayResponse, tags=["Replay"])
def replay(
    ref: Ref,
    step: Annotated[float, Query(ge=0.5, le=10.0, description="Seconds between frames")] = 1.0,
) -> dict:
    return payloads.replay(ref, round(step, 1))


# --- Strategy simulator -------------------------------------------------------

Plan = Annotated[
    str,
    Query(
        min_length=3,
        max_length=80,
        description="Stints as COMPOUND:LAPS[:AGE], comma separated, e.g. M:20,H:33",
    ),
]


@router.get("/simulator/model", response_model=SimulatorModelResponse, tags=["Simulator"])
def simulator_model(ref: Ref, driver: Annotated[str | None, Query(max_length=3)] = None) -> dict:
    return payloads.sim_describe(ref, norm_driver(driver) if driver else None)


@router.get("/simulator/simulate", response_model=SimulationResponse, tags=["Simulator"])
def simulator_simulate(
    ref: Ref,
    driver: Driver,
    plan: Plan,
    runs: Annotated[int, Query(ge=50, le=2000)] = 400,
    sc: Annotated[float | None, Query(ge=0, le=4, description="Expected safety cars")] = None,
    vsc: Annotated[float | None, Query(ge=0, le=4, description="Expected VSCs")] = None,
) -> dict:
    return payloads.sim_run(ref, norm_driver(driver), plan.upper().replace(" ", ""), runs, sc, vsc)


@router.get("/simulator/optimise", response_model=OptimiseResponse, tags=["Simulator"])
def simulator_optimise(
    ref: Ref,
    driver: Driver,
    conditions: Annotated[str, Query(pattern="^(green|hindsight)$")] = "green",
) -> dict:
    return payloads.sim_optimise(ref, norm_driver(driver), conditions)


@router.get("/simulator/undercut", response_model=UndercutResponse, tags=["Simulator"])
def simulator_undercut(
    ref: Ref,
    attacker: Driver,
    defender: Driver,
    lap: Annotated[int, Query(ge=1, le=100)],
    compound: Annotated[str | None, Query(max_length=12)] = None,
) -> dict:
    return payloads.sim_undercut(
        ref,
        norm_driver(attacker),
        norm_driver(defender),
        lap,
        compound.upper() if compound else None,
    )
