from fastapi import APIRouter

from app.schemas.race_schema import Race, RaceListResponse
from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/races",
    tags=["Races"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=RaceListResponse
)
def get_races():

    df = service.get_races()

    races = []

    for _, row in df.iterrows():

        races.append(
            Race(
                round_number=int(row["RoundNumber"]),
                event_name=row["EventName"],
                country=row["Country"],
                location=row["Location"]
            )
        )

    return RaceListResponse(
        season=2025,
        total_races=len(races),
        races=races
    )