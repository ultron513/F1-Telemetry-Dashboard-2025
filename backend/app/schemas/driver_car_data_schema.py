from pydantic import BaseModel
from typing import List


class CarDataPoint(BaseModel):
    distance: float
    speed: float
    throttle: float
    brake: bool
    rpm: float
    gear: int
    drs: int
    x: float
    y: float


class DriverCarDataResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int

    telemetry: List[CarDataPoint]