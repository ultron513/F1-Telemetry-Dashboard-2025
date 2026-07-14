from pydantic import BaseModel


class Race(BaseModel):
    round_number: int
    event_name: str
    country: str
    location: str


class RaceListResponse(BaseModel):
    season: int
    total_races: int
    races: list[Race]