from fastapi import APIRouter

from app.schemas.lap_delta_schema import (
    LapDeltaResponse,
    DeltaPoint
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/lap-delta",
    tags=["Lap Delta"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=LapDeltaResponse
)
def get_lap_delta(
    event_name: str,
    session_name: str,
    driver_1: str,
    lap_1: int,
    driver_2: str,
    lap_2: int
):

    delta = service.get_lap_delta(
        event_name,
        session_name,
        driver_1,
        lap_1,
        driver_2,
        lap_2
    )

    return LapDeltaResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver_1=driver_1,
        lap_1=lap_1,
        driver_2=driver_2,
        lap_2=lap_2,
        delta=[
            DeltaPoint(**row)
            for row in delta
        ]
    )