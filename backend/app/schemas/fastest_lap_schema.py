from pydantic import BaseModel


class FastestLapResponse(BaseModel):
    season: int
    event_name: str
    session_name: str

    driver: str
    lap_number: int
    lap_time_seconds: float