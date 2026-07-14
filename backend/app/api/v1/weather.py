from fastapi import APIRouter

from app.schemas.weather_schema import WeatherResponse
from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/weather",
    tags=["Weather"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=WeatherResponse
)
def get_weather(
    event_name: str,
    session_name: str
):

    weather = service.get_weather(
        event_name,
        session_name
    )

    return WeatherResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        **weather
    )