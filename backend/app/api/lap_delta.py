from fastapi import APIRouter

from app.services.season_service import SeasonService

router = APIRouter()

service = SeasonService()


@router.get("/lap-delta")
def get_lap_delta(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_lap_delta(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )