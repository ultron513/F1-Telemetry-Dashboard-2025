from __future__ import annotations

from app.schemas.common import DriverInfo, Model, SessionContext


class LapMeta(Model):
    lap: int | None = None
    time: float | None = None
    s1: float | None = None
    s2: float | None = None
    s3: float | None = None
    compound: str | None = None
    tyre_life: int | None = None
    position: int | None = None
    speed_trap: float | None = None
    deleted: bool = False


class Channels(Model):
    distance: list[float]
    time: list[float]
    speed: list[float]
    throttle: list[float]
    brake: list[int]
    rpm: list[int]
    gear: list[int]
    drs: list[int]
    x: list[float]
    y: list[float]


class TelemetryStats(Model):
    max_speed: float | None = None
    min_speed: float | None = None
    avg_speed: float | None = None
    max_rpm: int | None = None
    avg_rpm: int | None = None
    full_throttle_pct: float | None = None
    braking_pct: float | None = None
    coasting_pct: float | None = None
    drs_pct: float | None = None
    gear_changes: int
    top_gear: int
    distance: float | None = None


class BrakingZone(Model):
    start: float
    end: float
    entry_speed: float
    min_speed: float
    speed_drop: float
    decel_g: float


class CornerSpeed(Model):
    number: int | None
    letter: str = ""
    distance: float
    min_speed: float
    gear: int


class Insight(Model):
    kind: str
    title: str
    text: str


class TelemetryResponse(SessionContext):
    driver: DriverInfo
    lap: LapMeta
    sector_marks: list[float]
    channels: Channels
    stats: TelemetryStats
    braking_zones: list[BrakingZone]
    corners: list[CornerSpeed]
    insights: list[Insight]


class CompareSide(Model):
    driver: DriverInfo
    lap: LapMeta
    stats: TelemetryStats


class SectorDelta(Model):
    sector: str
    a: float | None = None
    b: float | None = None
    delta: float | None = None


class MiniSector(Model):
    index: int
    start: float
    end: float
    time_a: float
    time_b: float
    winner: str
    gain: float


class Dominance(Model):
    a: int
    b: int


class CompareResponse(SessionContext):
    a: CompareSide
    b: CompareSide
    distance: list[float]
    channels_a: Channels
    channels_b: Channels
    delta: list[float]
    final_delta: float | None = None
    sector_marks: list[float]
    sectors: list[SectorDelta]
    minisectors: list[MiniSector]
    dominance: Dominance


class Corner(Model):
    number: int | None
    letter: str = ""
    x: float | None = None
    y: float | None = None
    angle: float | None = 0.0
    distance: float | None = None


class Outline(Model):
    x: list[float]
    y: list[float]
    distance: list[float]


class ReferenceLap(Model):
    driver: str | None = None
    lap: int | None = None
    time: float | None = None


class DrsZone(Model):
    start: float
    end: float


class CircuitResponse(SessionContext):
    length: float
    rotation: float
    corner_source: str
    reference: ReferenceLap
    outline: Outline
    corners: list[Corner]
    sectors: list[float]
    drs_zones: list[DrsZone]
