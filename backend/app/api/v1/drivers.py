from fastapi import APIRouter

from app.schemas.driver_schema import (
    Driver,
    DriverListResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/drivers",
    tags=["Drivers"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=DriverListResponse
)
def get_drivers(
    event_name: str,
    session_name: str
):

    drivers = service.get_drivers(
        event_name,
        session_name
    )

    return DriverListResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        total_drivers=len(drivers),
        drivers=[
            Driver(**driver)
            for driver in drivers
        ]
    )