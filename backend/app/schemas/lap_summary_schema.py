from pydantic import BaseModel


class LapSummaryResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    driver: str
    lap_number: int

    lap_time_seconds: float

    max_speed: float
    average_speed: float

    max_rpm: int

    average_throttle: float

    brake_percentage: float

    drs_percentage: float

    telemetry_samples: int