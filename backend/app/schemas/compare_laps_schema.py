from pydantic import BaseModel


class CompareLapSummary(BaseModel):
    driver: str
    lap_number: int

    lap_time_seconds: float
    max_speed: float
    average_speed: float


class CompareLapsResponse(BaseModel):
    season: int
    event_name: str
    session_name: str

    lap_1: CompareLapSummary
    lap_2: CompareLapSummary