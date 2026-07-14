from fastapi import APIRouter

from app.services.season_service import SeasonService

router = APIRouter(prefix="/standings", tags=["Standings"])

service = SeasonService()


@router.get("/drivers")
def get_driver_standings():
    return service.get_driver_standings()