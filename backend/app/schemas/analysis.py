from __future__ import annotations

from app.schemas.common import DriverInfo, Model, SessionContext


class StyleAxis(Model):
    key: str
    label: str
    description: str


class LapRef(Model):
    lap: int | None = None
    time: float | None = None


class DriverStyle(Model):
    """``corners`` rows: number, letter, class (slow/medium/fast), apex_distance,
    brake_point, braked, entry/apex/exit_speed, gear, throttle_pickup, time."""

    code: str
    team: str
    team_color: str | None = None
    lap: LapRef | None = None
    scores: dict[str, float | None]
    raw: dict[str, float | None]
    corners: list[dict]


class StyleResponse(SessionContext):
    axes: list[StyleAxis]
    drivers: list[DriverStyle]
    field_size: int
    comparison: list[dict]


class MiniSectorBest(Model):
    index: int
    start: float | None = None
    end: float | None = None
    best: float | None = None
    best_lap: int
    sector: int
    fastest_lap_time: float | None = None
    loss: float | None = None


class FieldIdeal(Model):
    code: str
    team: str
    team_color: str | None = None
    best: float | None = None
    theoretical: float | None = None
    gain: float | None = None


class IdealLapResponse(SessionContext):
    driver: DriverInfo
    laps_used: list[int]
    fastest_lap: LapRef
    ideal_time: float | None = None
    gain: float | None = None
    sector_theoretical: float | None = None
    minisectors: list[MiniSectorBest]
    field: list[FieldIdeal]


class TeamCar(Model):
    team: str
    team_color: str | None = None
    driver: str
    lap_time: float | None = None
    speed_trap: float | None = None
    top_speed: float | None = None
    slow_corners: float | None = None
    medium_corners: float | None = None
    fast_corners: float | None = None
    full_throttle: float | None = None
    straight_index: float | None = None
    corner_index: float | None = None
    drag_bias: float | None = None
    profile: str


class CarsResponse(SessionContext):
    teams: list[TeamCar]


class TyreManager(Model):
    code: str
    team: str | None = None
    team_color: str | None = None
    relative_degradation: float | None = None
    consistency: float | None = None
    stints: int
    score: float


class TeammateTyres(Model):
    team: str | None = None
    drivers: list[str]
    delta: float | None = None


class TyreManagementResponse(SessionContext):
    compound_median: dict[str, float | None]
    drivers: list[TyreManager]
    teammates: list[TeammateTyres]


class BattleRound(Model):
    round: int
    race: str | None = None
    quali: str | None = None
    quali_source: str | None = None
    pace_gap: float | None = None


class TeammatePair(Model):
    team: str
    team_color: str | None = None
    drivers: list[str]
    race: list[int]
    quali: list[int]
    points: list[float | None]
    pace_gap: float | None = None
    pace_races: int
    races: int
    rounds: list[BattleRound]


class Ingested(Model):
    season: int
    round: int
    session: str


class TeammateBattleResponse(Model):
    season: int
    rounds: list[int]
    pairs: list[TeammatePair]
    ingested: list[Ingested]
