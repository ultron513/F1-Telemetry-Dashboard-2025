from pydantic import BaseModel
from typing import List

class PitStop(BaseModel):
    driver: str
    stop: int
    lap: int
    duration: float


class PitStopsResponse(BaseModel):
    season: int
    event_name: str

    pit_stops: List[PitStop]