from fastapi import APIRouter
from app.schemas.lap_schema import AvailableLapsResponse
from app.schemas.lap_schema import (
    Lap,
    LapListResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/laps",
    tags=["Laps"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=LapListResponse
)
def get_laps(
    event_name: str,
    session_name: str,
    driver: str
):

    lap_numbers = service.get_laps(
        event_name,
        session_name,
        driver
    )

    return LapListResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        total_laps=len(lap_numbers),
        laps=[
            Lap(lap_number=lap)
            for lap in lap_numbers
        ]
    )

@router.get(
    "/available-laps/",
    response_model=AvailableLapsResponse
)
def get_available_laps(
    event_name: str,
    session_name: str,
    driver: str,
):
    return AvailableLapsResponse(
        **service.get_available_laps(
            event_name,
            session_name,
            driver,
        )
    )