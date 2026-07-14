from fastapi import APIRouter

from app.services.season_service import SeasonService

from app.schemas.driver_standings_schema import (
    DriverStanding,
    DriverStandingsResponse
)

router = APIRouter(
    prefix="/api/v1/driver-standings",
    tags=["Driver Standings"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=DriverStandingsResponse
)
def get_driver_standings(
    event_name: str
):

    standings = service.get_driver_standings(
        event_name
    )

    return DriverStandingsResponse(
        season=2025,
        event_name=event_name,
        standings=[
            DriverStanding(**row)
            for row in standings
        ]
    )