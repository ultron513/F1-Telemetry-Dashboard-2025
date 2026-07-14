from fastapi import APIRouter

from app.services.season_service import SeasonService

from app.schemas.constructor_standings_schema import (
    ConstructorStanding,
    ConstructorStandingsResponse
)

router = APIRouter(
    prefix="/api/v1/constructor-standings",
    tags=["Constructor Standings"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=ConstructorStandingsResponse
)
def get_constructor_standings(
    event_name: str
):

    standings = service.get_constructor_standings(
        event_name
    )

    return ConstructorStandingsResponse(
        season=2025,
        event_name=event_name,
        standings=[
            ConstructorStanding(**row)
            for row in standings
        ]
    )