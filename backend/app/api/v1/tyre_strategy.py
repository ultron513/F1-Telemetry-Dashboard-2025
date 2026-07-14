from fastapi import APIRouter

from app.services.season_service import SeasonService

from app.schemas.tyre_strategy_schema import (
    TyreStrategyResponse,
    TyreStint
)

router = APIRouter(
    prefix="/api/v1/tyre-strategy",
    tags=["Tyre Strategy"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=TyreStrategyResponse
)
def get_tyre_strategy(
    event_name: str,
    session_name: str,
    driver: str
):
    stints = service.get_tyre_strategy(
        event_name,
        session_name,
        driver,
    )
    return TyreStrategyResponse(
        season=2025,
        event_name=event_name,
        stints=[
            TyreStint(**row)
            for row in stints
        ]
    )