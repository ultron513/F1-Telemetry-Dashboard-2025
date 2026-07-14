from fastapi import APIRouter

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/constructors",
    tags=["Constructors"],
)

service = SeasonService()


@router.get("/standings")
def get_constructor_standings():
    return service.get_constructor_standings()