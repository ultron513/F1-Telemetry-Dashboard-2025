from pydantic import BaseModel
from typing import List


class SessionResult(BaseModel):
    position: int
    driver: str
    driver_number: str
    team: str
    grid_position: int
    status: str
    points: float


class SessionResultsResponse(BaseModel):
    season: int
    event_name: str
    session_name: str

    results: List[SessionResult]