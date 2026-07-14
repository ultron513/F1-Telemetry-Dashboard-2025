from pydantic import BaseModel
from typing import List


# ==========================================================
# STEP 50 — RACE CONTROL
# ==========================================================

class RaceControlMessage(BaseModel):
    category: str
    message: str
    lap: int
    time: str


class RaceControlResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    messages: List[RaceControlMessage]


# ==========================================================
# STEP 51 — SAFETY CAR
# ==========================================================

class SafetyCarEvent(BaseModel):
    lap: int
    status: str


class SafetyCarResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    events: List[SafetyCarEvent]


# ==========================================================
# STEP 52 — RED FLAG
# ==========================================================

class RedFlagEvent(BaseModel):
    lap: int
    time: str


class RedFlagResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    events: List[RedFlagEvent]


# ==========================================================
# STEP 53 — TRACK STATUS
# ==========================================================

class TrackStatusPoint(BaseModel):
    time: str
    status: str


class TrackStatusResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    statuses: List[TrackStatusPoint]


# ==========================================================
# STEP 54 — LIVE TIMING
# ==========================================================

class LiveTimingEntry(BaseModel):
    driver: str
    position: int
    gap: str


class LiveTimingResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    timing: List[LiveTimingEntry]


# ==========================================================
# STEP 55 — WEATHER HISTORY
# ==========================================================

class WeatherHistoryPoint(BaseModel):
    time: str
    air_temperature: float
    track_temperature: float
    humidity: float
    pressure: float
    wind_speed: float
    wind_direction: float
    rainfall: bool


class WeatherHistoryResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    history: List[WeatherHistoryPoint]


# ==========================================================
# STEP 56 — SECTOR ANALYSIS
# ==========================================================

class SectorAnalysis(BaseModel):
    driver: str
    lap_number: int
    sector1: float
    sector2: float
    sector3: float
    total: float


class SectorAnalysisResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    sectors: List[SectorAnalysis]


# ==========================================================
# STEP 57 — MINI SECTOR ANALYSIS
# ==========================================================

class MiniSectorPoint(BaseModel):
    minisector: int
    distance: float
    speed: float


class MiniSectorResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    minisectors: List[MiniSectorPoint]


# ==========================================================
# STEP 58 — SPEED TRAP
# ==========================================================

class SpeedTrapEntry(BaseModel):
    driver: str
    sector1_speed: float
    sector2_speed: float
    finish_speed: float
    max_speed: float


class SpeedTrapResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    speed_traps: List[SpeedTrapEntry]


# ==========================================================
# STEP 59 — GEAR SHIFT ANALYSIS
# ==========================================================

class GearShiftPoint(BaseModel):
    distance: float
    gear: int
    rpm: float


class GearShiftResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    shifts: List[GearShiftPoint]


# ==========================================================
# STEP 60 — THROTTLE / BRAKE ANALYSIS
# ==========================================================

class ThrottleBrakePoint(BaseModel):
    distance: float
    throttle: float
    brake: bool


class ThrottleBrakeResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    telemetry: List[ThrottleBrakePoint]

# ==========================================================
# STEP 61 — DRS ANALYSIS
# ==========================================================

class DRSPoint(BaseModel):
    distance: float
    drs: int


class DRSResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    telemetry: List[DRSPoint]


# ==========================================================
# STEP 62 — ERS ANALYSIS
# ==========================================================

class ERSPoint(BaseModel):
    distance: float
    deployment: float
    harvesting: float


class ERSResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    telemetry: List[ERSPoint]


# ==========================================================
# STEP 63 — CORNER PERFORMANCE
# ==========================================================

class CornerPerformancePoint(BaseModel):
    corner: int
    minimum_speed: float
    entry_speed: float
    apex_speed: float
    exit_speed: float


class CornerPerformanceResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    corners: List[CornerPerformancePoint]


# ==========================================================
# STEP 64 — DRIVER CONSISTENCY
# ==========================================================

class DriverConsistencyPoint(BaseModel):
    lap_number: int
    lap_time: float
    deviation: float


class DriverConsistencyResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    consistency: List[DriverConsistencyPoint]


# ==========================================================
# STEP 65 — RACE PACE
# ==========================================================

class RacePacePoint(BaseModel):
    driver: str
    average_lap: float
    fastest_lap: float
    total_laps: int


class RacePaceResponse(BaseModel):
    season: int
    event_name: str
    pace: List[RacePacePoint]


# ==========================================================
# STEP 66 — QUALIFYING PACE
# ==========================================================

class QualifyingPacePoint(BaseModel):
    driver: str
    q1: float | None = None
    q2: float | None = None
    q3: float | None = None
    best: float


class QualifyingPaceResponse(BaseModel):
    season: int
    event_name: str
    pace: List[QualifyingPacePoint]


# ==========================================================
# STEP 67 — TELEMETRY STATISTICS
# ==========================================================

class TelemetryStatisticsResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int

    max_speed: float
    average_speed: float

    max_rpm: int
    average_rpm: float

    average_throttle: float

    brake_percentage: float

    drs_percentage: float

    telemetry_samples: int


# ==========================================================
# STEP 68 — CACHE STATUS
# ==========================================================

class CacheResponse(BaseModel):
    cache_enabled: bool
    cache_entries: int
    cache_size_mb: float


# ==========================================================
# STEP 69 — BACKEND VALIDATION
# ==========================================================

class BackendValidationResponse(BaseModel):
    season_loader: bool
    telemetry_engine: bool
    fastf1_available: bool
    api_ready: bool


# ==========================================================
# STEP 70 — BACKEND PERFORMANCE
# ==========================================================

class PerformanceResponse(BaseModel):
    endpoint: str
    execution_time_ms: float
    cache_hit: bool


# ==========================================================
# STEP 71–72 — BACKEND STATUS
# ==========================================================

class BackendStatusResponse(BaseModel):
    version: str
    backend_status: str
    total_routes: int
    uptime: str