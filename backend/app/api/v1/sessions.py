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
