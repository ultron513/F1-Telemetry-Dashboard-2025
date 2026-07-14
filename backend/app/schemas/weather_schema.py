from pydantic import BaseModel


class WeatherResponse(BaseModel):
    season: int
    event_name: str
    session_name: str

    air_temperature: float
    track_temperature: float

    humidity: float

    pressure: float

    wind_speed: float

    wind_direction: float

    rainfall: bool