from pydantic import BaseModel
from typing import List


class PositionPoint(BaseModel):
    x: float
    y: float
    z: float
    distance: float


class DriverPositionResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int

    positions: List[PositionPoint]