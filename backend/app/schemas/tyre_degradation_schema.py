from pydantic import BaseModel


class TyreDegradationLap(BaseModel):
    lap: int
    lap_time: float


class TyreDegradationResponse(BaseModel):
    season: int
    event_name: str
    driver: str
    degradation: list[TyreDegradationLap]