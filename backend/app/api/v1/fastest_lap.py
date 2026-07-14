from fastapi import APIRouter

from app.schemas.fastest_lap_schema import FastestLapResponse
from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/fastest-lap",
    tags=["Fastest Lap"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=FastestLapResponse
)
def get_fastest_lap(
    event_name: str,
    session_name: str
):

    fastest = service.get_fastest_lap(
        event_name,
        session_name
    )

    return FastestLapResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        **fastest
    )