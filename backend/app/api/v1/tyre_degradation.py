from fastapi import APIRouter

from app.services.season_service import SeasonService
from app.schemas.tyre_degradation_schema import (
    TyreDegradationResponse,
    TyreDegradationLap,
)

router = APIRouter(
    prefix="/api/v1/tyre-degradation",
    tags=["Tyre Degradation"],
)

service = SeasonService()


@router.get(
    "/",
    response_model=TyreDegradationResponse,
)
def get_tyre_degradation(
    event_name: str,
    session_name: str,
    driver: str,
):

    data = service.get_tyre_degradation(
        event_name,
        session_name,
        driver,
    )

    return TyreDegradationResponse(
        season=2025,
        event_name=event_name,
        driver=driver,
        degradation=[
            TyreDegradationLap(**row)
            for row in data
        ],
    )