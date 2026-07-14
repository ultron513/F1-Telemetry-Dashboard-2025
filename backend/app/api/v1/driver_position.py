from fastapi import APIRouter

from app.schemas.driver_position_schema import (
    DriverPositionResponse,
    PositionPoint
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/driver-position",
    tags=["Driver Position"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=DriverPositionResponse
)
def get_driver_position(
    event_name: str,
    session_name: str,
    driver: str,
    lap_number: int
):

    positions = service.get_driver_position(
        event_name,
        session_name,
        driver,
        lap_number
    )

    return DriverPositionResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        lap_number=lap_number,
        positions=[
            PositionPoint(**row)
            for row in positions
        ]
    )