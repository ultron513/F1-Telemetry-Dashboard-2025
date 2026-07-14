from pydantic import BaseModel
from typing import List


class DeltaPoint(BaseModel):
    distance: float
    delta_seconds: float


class LapDeltaResponse(BaseModel):
    season: int
    event_name: str
    session_name: str

    driver_1: str
    lap_1: int

    driver_2: str
    lap_2: int

    delta: List[DeltaPoint]