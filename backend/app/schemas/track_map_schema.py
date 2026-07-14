from pydantic import BaseModel
from typing import List


class TrackPoint(BaseModel):
    x: float
    y: float


class TrackMapResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int

    points: List[TrackPoint]