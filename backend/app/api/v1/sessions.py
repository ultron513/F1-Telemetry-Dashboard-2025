from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api import payloads
from app.api.deps import norm_driver, norm_lap, session_ref
from app.data.schedule import SessionRef
from app.schemas.analysis import (
    CarsResponse,
    IdealLapResponse,
    StyleResponse,
    TyreManagementResponse,
)
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


# --- Driver & car analysis ---------------------------------------------------


@router.get("/analysis/style", response_model=StyleResponse, tags=["Analysis"])
def analysis_style(
    ref: Ref,
    drivers: Annotated[str, Query(description="One or two driver codes, comma separated")],
) -> dict:
    codes = tuple(dict.fromkeys(norm_driver(c) for c in drivers.split(",") if c.strip()))[:2]
    return payloads.style(ref, codes)


@router.get("/analysis/ideal-lap", response_model=IdealLapResponse, tags=["Analysis"])
def analysis_ideal_lap(ref: Ref, driver: Driver) -> dict:
    return payloads.ideal_lap(ref, norm_driver(driver))


@router.get("/analysis/cars", response_model=CarsResponse, tags=["Analysis"])
def analysis_cars(ref: Ref) -> dict:
    return payloads.cars(ref)


@router.get("/analysis/tyre-management", response_model=TyreManagementResponse, tags=["Analysis"])
def analysis_tyre_management(ref: Ref) -> dict:
    return payloads.tyre_management(ref)


# --- Visualisation -------------------------------------------------------------


@router.get("/circuit/3d", tags=["Circuit"], summary="Track outline with elevation (metres)")
def circuit_3d(ref: Ref) -> dict:
    return payloads.circuit_3d(ref)


@router.get(
    "/replay/onboard", tags=["Replay"], summary="One car's dashboard channels on the replay clock"
)
def replay_onboard(
    ref: Ref,
    driver: Driver,
    step: Annotated[float, Query(ge=0.25, le=2.0)] = 0.5,
) -> dict:
    return payloads.onboard(ref, norm_driver(driver), round(step, 2))
