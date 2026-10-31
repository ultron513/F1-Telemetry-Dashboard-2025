from __future__ import annotations

from app.schemas.common import DriverInfo, Model, SessionContext
from app.schemas.events import Event


class ResultRow(Model):
    position: int | None = None
    classified_position: str | None = None
    code: str
    number: str
    full_name: str
    team: str
    team_color: str | None = None
    grid: int | None = None
    status: str | None = None
    points: float | None = None
    laps: int | None = None
    time_text: str | None = None
    gap: float | None = None
    best_lap: float | None = None
    best_lap_number: int | None = None
    fastest_lap: bool = False
    q1: float | None = None
    q2: float | None = None
    q3: float | None = None


class FastestLap(Model):
    driver: str
    team: str
    time: float | None = None
    lap: int | None = None


class Highlights(Model):
    winner: str | None = None
    winner_team: str | None = None
    podium: list[str]
    fastest_lap: FastestLap | None = None
    total_laps: int | None = None
    laps_recorded: int
    timed_laps: int
    pit_stops: int
    position_changes: int | None = None
    retirements: list[str]
    safety_car: int
    vsc: int
    red_flag: int
    yellow: int


class WeatherSnapshot(Model):
    air_temp: float | None = None
    track_temp: float | None = None
    track_temp_max: float | None = None
    humidity: float | None = None
    wind_speed: float | None = None
    rainfall: bool = False


class SessionSummary(SessionContext):
    event: Event
    drivers: list[DriverInfo]
    results: list[ResultRow]
    highlights: Highlights
    weather: WeatherSnapshot | None = None


class DriversResponse(SessionContext):
    drivers: list[DriverInfo]


class ResultsResponse(SessionContext):
    results: list[ResultRow]
