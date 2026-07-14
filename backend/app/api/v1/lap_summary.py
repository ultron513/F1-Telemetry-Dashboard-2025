from fastapi import APIRouter

from app.schemas.lap_summary_schema import (
    LapSummaryResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/lap-summary",
    tags=["Lap Summary"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=LapSummaryResponse
)
def get_lap_summary(
    event_name: str,
    session_name: str,
    driver: str,
    lap_number: int
):

    summary = service.get_lap_summary(
        event_name,
        session_name,
        driver,
        lap_number
    )

    return LapSummaryResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        lap_number=lap_number,
        **summary
    )