from fastapi import APIRouter

from app.schemas.track_map_schema import (
    TrackMapResponse,
    TrackPoint
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/track-map",
    tags=["Track Map"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=TrackMapResponse
)
def get_track_map(
    event_name: str,
    session_name: str,
    driver: str,
    lap_number: int
):

    points = service.get_track_map(
        event_name,
        session_name,
        driver,
        lap_number
    )

    return TrackMapResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        lap_number=lap_number,
        points=[
            TrackPoint(**point)
            for point in points
        ]
    )