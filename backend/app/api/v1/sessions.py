from fastapi import APIRouter

from app.schemas.session_schema import (
    Session,
    SessionListResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/sessions",
    tags=["Sessions"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=SessionListResponse
)
def get_sessions(event_name: str):

    sessions = service.get_sessions(event_name)

    return SessionListResponse(
        season=2025,
        event_name=event_name,
        sessions=[
            Session(name=s)
            for s in sessions
        ]
    )