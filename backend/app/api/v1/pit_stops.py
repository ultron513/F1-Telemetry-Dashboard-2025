from fastapi import APIRouter

from app.services.season_service import SeasonService

from app.schemas.pit_stop_schema import (
    PitStopsResponse,
    PitStop,
)

router = APIRouter(
    prefix="/api/v1/pit-stops",
    tags=["Pit Stops"],
)

service = SeasonService()


@router.get(
    "/",
    response_model=PitStopsResponse,
)
def get_pit_stops(
    event_name: str,
    session_name: str,
    driver: str,
):

    pit_stops = service.get_pit_stops(
        event_name,
        session_name,
        driver,
    )

    return PitStopsResponse(
        season=2025,
        event_name=event_name,
        pit_stops=[
            PitStop(**row)
            for row in pit_stops
        ],
    )