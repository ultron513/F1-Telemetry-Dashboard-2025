"""Schemas for race control, weather, ratings, standings and replay."""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import Model, SessionContext

# --- Race control -----------------------------------------------------------


class RaceControlMessage(Model):
    id: int
    time_utc: str | None = None
    session_time: float | None = None
    lap: int | None = None
    category: str
    kind: str
    severity: str
    title: str
    message: str
    flag: str | None = None
    status: str | None = None
    scope: str | None = None
    sector: int | None = None
    drivers: list[str]


class TrackStatusSegment(Model):
    status: str
    label: str
    start: float | None = None
    end: float | None = None
    start_lap: int | None = None
    end_lap: int | None = None


class SessionWindow(Model):
    start: float | None = None
    end: float | None = None


class RaceControlResponse(SessionContext):
    messages: list[RaceControlMessage]
    counts: dict[str, int]
    track_status: list[TrackStatusSegment]
    session_window: SessionWindow
    total_laps: int | None = None


# --- Weather ----------------------------------------------------------------


class WeatherSeries(Model):
    minute: list[float]
    air_temp: list[float | None]
    track_temp: list[float | None]
    humidity: list[float | None]
    pressure: list[float | None]
    wind_speed: list[float | None]
    wind_direction: list[float | None]
    rainfall: list[bool]


class Stat(Model):
    min: float | None = None
    max: float | None = None
    mean: float | None = None
    start: float | None = None
    end: float | None = None


class WeatherSummary(Model):
    air_temp: Stat
    track_temp: Stat
    humidity: Stat
    pressure: Stat
    wind_speed: Stat
    rain_share: float | None = None
    samples: int


class WindBand(Model):
    from_: float = Field(alias="from")
    to: float
    share: float


class WindSector(Model):
    direction: str
    share: float
    bands: list[WindBand]


class RainWindow(Model):
    start: float
    end: float


class WeatherResponse(SessionContext):
    series: WeatherSeries | None = None
    summary: WeatherSummary | None = None
    wind_rose: list[WindSector]
    rain_windows: list[RainWindow]


# --- Ratings ----------------------------------------------------------------


class RatingMetric(Model):
    key: str
    label: str
    higher_is_better: bool
    unit: str
    weight: float


class DriverRating(Model):
    code: str
    team: str
    team_color: str | None = None
    overall: float | None = None
    rank: int
    scores: dict[str, float | None]
    raw: dict[str, float | None]


class RatingsResponse(SessionContext):
    metrics: list[RatingMetric]
    drivers: list[DriverRating]


# --- Standings --------------------------------------------------------------


class DriverStanding(Model):
    position: int
    code: str
    driver_id: str
    number: str | None = None
    full_name: str
    nationality: str | None = None
    team: str | None = None
    team_id: str | None = None
    points: float
    wins: int
    podiums: int = 0
    poles: int = 0


class ConstructorStanding(Model):
    position: int
    team: str
    team_id: str | None = None
    nationality: str | None = None
    points: float
    wins: int


class RoundLabel(Model):
    round: int
    name: str


class Progression(Model):
    rounds: list[RoundLabel]
    drivers: dict[str, list[float]]
    constructors: dict[str, list[float]]


class StandingsResponse(Model):
    season: int
    source: str
    round: int
    drivers: list[DriverStanding]
    constructors: list[ConstructorStanding]
    progression: Progression
    rounds_included: list[int]


# --- Replay -----------------------------------------------------------------


class PitWindow(Model):
    start: float
    end: float | None = None
    lap: int | None = None


class ReplayStint(Model):
    compound: str
    start_lap: int | None = None
    end_lap: int | None = None


class ReplayDriver(Model):
    code: str
    number: str
    team: str
    team_color: str | None = None
    progress: list[int]
    finished_at: float
    retired: bool
    grid: int | None = None
    laps_completed: int
    pits: list[PitWindow]
    stints: list[ReplayStint]


class ReplayResponse(SessionContext):
    start: float
    end: float
    step: float
    frames: int
    total_laps: int | None = None
    progress_scale: int
    drivers: list[ReplayDriver]
