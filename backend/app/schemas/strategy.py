from __future__ import annotations

from app.schemas.common import DriverInfo, Model, SessionContext


class Stint(Model):
    stint: int | None = None
    compound: str
    start_lap: int | None = None
    end_lap: int | None = None
    laps: int
    start_age: int | None = None
    fresh: bool = False
    average: float | None = None
    degradation: float | None = None
    fuel_corrected_degradation: float | None = None
    fit_r2: float | None = None


class DriverStints(Model):
    code: str
    team: str | None = None
    team_color: str | None = None
    stints: list[Stint]


class PitStop(Model):
    code: str
    team: str
    team_color: str | None = None
    stop: int
    lap: int | None = None
    pit_lane_time: float | None = None
    from_compound: str | None = None
    to_compound: str | None = None
    under: str | None = None


class StrategyResponse(SessionContext):
    total_laps: int | None = None
    stints: list[DriverStints]
    pit_stops: list[PitStop]
    pit_loss: float | None = None
    median_pit_lane: float | None = None
    fastest_pit_lane: PitStop | None = None
    compound_degradation: dict[str, float | None]


class TracePoint(Model):
    lap: int
    position: int | None = None
    gap: float | None = None


class DriverTrace(Model):
    code: str
    team: str
    team_color: str | None = None
    points: list[TracePoint]


class LapStatus(Model):
    lap: int
    status: str


class RaceTraceResponse(SessionContext):
    total_laps: int | None = None
    drivers: list[DriverTrace]
    lap_status: list[LapStatus]


class DegLap(Model):
    lap: int | None = None
    tyre_life: int | None = None
    time: float | None = None
    fuel_corrected: float | None = None


class DegStint(Model):
    stint: int | None = None
    compound: str
    start_lap: int | None = None
    end_lap: int | None = None
    laps: list[DegLap]
    slope: float | None = None
    intercept: float | None = None
    r2: float | None = None
    fuel_corrected_slope: float | None = None
    fuel_corrected_intercept: float | None = None
    fuel_corrected_r2: float | None = None


class DegradationResponse(SessionContext):
    driver: DriverInfo
    fuel_effect_per_lap: float
    stints: list[DegStint]


class StintCall(Model):
    stint: int | None = None
    compound: str
    laps: int
    degradation: float | None = None
    optimal_length: float | None = None
    verdict: str


class RecommendationResponse(SessionContext):
    driver: DriverInfo
    pit_loss: float
    pit_loss_source: str
    risk: str
    stints: list[StintCall]
