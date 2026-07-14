from fastapi import APIRouter

from app.schemas.team_schema import (
    Team,
    TeamListResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/teams",
    tags=["Teams"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=TeamListResponse
)
def get_teams(
    event_name: str,
    session_name: str
):

    teams = service.get_teams(
        event_name,
        session_name
    )

    return TeamListResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        total_teams=len(teams),
        teams=[
            Team(name=team)
            for team in teams
        ]
    )