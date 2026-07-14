from pydantic import BaseModel


class TelemetryPoint(BaseModel):
    distance: float
    speed: float
    throttle: float
    brake: bool
    rpm: int
    gear: int
    drs: int


class TelemetryResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int
    total_samples: int
    telemetry: list[TelemetryPoint]

from pydantic import BaseModel

class LapDeltaPoint(BaseModel):
    distance: float
    delta: float