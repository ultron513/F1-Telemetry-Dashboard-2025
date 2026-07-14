from fastapi import APIRouter

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/race-control",
    tags=["Race Control"],
)

service = SeasonService()


@router.get("")
def get_race_control(
    event_name: str,
    session_name: str,
):
    return service.get_race_control(
        event_name,
        session_name,
    )