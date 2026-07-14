from fastapi import APIRouter

from app.schemas.driver_car_data_schema import (
    DriverCarDataResponse,
    CarDataPoint
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/driver-car-data",
    tags=["Driver Car Data"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=DriverCarDataResponse
)
def get_driver_car_data(
    event_name: str,
    session_name: str,
    driver: str,
    lap_number: int
):

    telemetry = service.get_driver_car_data(
        event_name,
        session_name,
        driver,
        lap_number
    )

    return DriverCarDataResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        lap_number=lap_number,
        telemetry=[
            CarDataPoint(**row)
            for row in telemetry
        ]
    )