from pydantic import BaseModel
from typing import List


class ConstructorStanding(BaseModel):
    position: int
    team: str
    points: float
    wins: int


class ConstructorStandingsResponse(BaseModel):
    season: int
    event_name: str

    standings: List[ConstructorStanding]