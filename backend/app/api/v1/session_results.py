from fastapi import APIRouter

from app.schemas.session_results_schema import (
    SessionResultsResponse,
    SessionResult
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/session-results",
    tags=["Session Results"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=SessionResultsResponse
)
def get_session_results(
    event_name: str,
    session_name: str
):

    results = service.get_session_results(
        event_name,
        session_name
    )

    return SessionResultsResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        results=[
            SessionResult(**row)
            for row in results
        ]
    )