from pydantic import BaseModel
from typing import List


class DriverStanding(BaseModel):
    position: int
    driver: str
    team: str
    points: float
    wins: int


class DriverStandingsResponse(BaseModel):
    season: int
    event_name: str

    standings: List[DriverStanding]