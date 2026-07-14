from pydantic import BaseModel


class Lap(BaseModel):
    lap_number: int


class LapListResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    total_laps: int
    laps: list[Lap]

from pydantic import BaseModel

class AvailableLapsResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    total_laps: int
    laps: list[int]