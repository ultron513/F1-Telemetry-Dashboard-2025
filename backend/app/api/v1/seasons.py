from fastapi import APIRouter

from app.schemas.season_schema import SeasonsResponse

router = APIRouter(
    prefix="/api/v1/seasons",
    tags=["Seasons"]
)


@router.get(
    "/",
    response_model=SeasonsResponse
)
def get_seasons():

    return SeasonsResponse(
        available_seasons=[2025],
        default_season=2025
    )