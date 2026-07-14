from fastapi import APIRouter

from app.schemas.compare_laps_schema import (
    CompareLapSummary,
    CompareLapsResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/compare-laps",
    tags=["Compare Laps"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=CompareLapsResponse
)
def compare_laps(
    event_name: str,
    session_name: str,
    driver_1: str,
    lap_1: int,
    driver_2: str,
    lap_2: int
):

    comparison = service.compare_laps(
        event_name,
        session_name,
        driver_1,
        lap_1,
        driver_2,
        lap_2
    )

    return CompareLapsResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        lap_1=CompareLapSummary(**comparison["lap_1"]),
        lap_2=CompareLapSummary(**comparison["lap_2"])
    )