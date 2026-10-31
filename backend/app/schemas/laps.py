from __future__ import annotations

from app.schemas.common import DriverInfo, Model, SessionContext


class LapRow(Model):
    lap: int | None
    time: float | None = None
    s1: float | None = None
    s2: float | None = None
    s3: float | None = None
    grade: str | None = None
    s1_grade: str | None = None
    s2_grade: str | None = None
    s3_grade: str | None = None
    compound: str | None = None
    tyre_life: int | None = None
    fresh_tyre: bool = False
    stint: int | None = None
    position: int | None = None
    pit_in: bool = False
    pit_out: bool = False
    track_status: list[str] = []
    deleted: bool = False
    deleted_reason: str | None = None
    speed_i1: float | None = None
    speed_i2: float | None = None
    speed_fl: float | None = None
    speed_st: float | None = None
    personal_best: bool = False


class Bests(Model):
    lap: float | None = None
    s1: float | None = None
    s2: float | None = None
    s3: float | None = None


class LapStats(Model):
    best_lap: float | None = None
    theoretical_best: float | None = None
    average_clean: float | None = None
    median_clean: float | None = None
    std_clean: float | None = None
    clean_laps: int
    total_laps: int
    pit_stops: int


class StintSummary(Model):
    stint: int | None = None
    compound: str | None = None
    start_lap: int | None = None
    end_lap: int | None = None
    laps: int
    average: float | None = None
    best: float | None = None


class LapTableResponse(SessionContext):
    driver: DriverInfo
    laps: list[LapRow]
    session_best: Bests
    personal_best: Bests
    stats: LapStats
    stints: list[StintSummary]


class PaceLap(Model):
    lap: int | None
    time: float | None
    compound: str | None = None
    tyre_life: int | None = None


class DriverPace(Model):
    code: str
    team: str
    team_color: str | None = None
    laps: list[PaceLap]
    min: float | None = None
    q1: float | None = None
    median: float | None = None
    q3: float | None = None
    max: float | None = None
    mean: float | None = None
    std: float | None = None
    gap_to_best: float | None = None


class FieldPaceResponse(SessionContext):
    drivers: list[DriverPace]
