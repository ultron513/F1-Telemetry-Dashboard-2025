from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.data import schedule
from app.schemas.analysis import TeammateBattleResponse
from app.schemas.events import Event, EventsResponse
from app.schemas.misc import StandingsResponse
from app.services import season as season_svc
from app.services.standings import standings as standings_svc

router = APIRouter(prefix="/seasons/{season}", tags=["Calendar & Championship"])

Season = Annotated[int, Path(ge=2018, le=2100)]


@router.get("/events", response_model=EventsResponse, summary="Season calendar")
def events(season: Season) -> dict:
    items = schedule.list_events(season)
    upcoming = [e for e in items if e["status"] in {"upcoming", "live"}]
    completed = [e for e in items if e["status"] == "completed"]
    return {
        "season": season,
        "events": items,
        "next_event": upcoming[0] if upcoming else None,
        "last_completed": completed[-1] if completed else None,
    }


@router.get("/events/{round}", response_model=Event, summary="Single event")
def event(season: Season, round: Annotated[int, Path(ge=1, le=30)]) -> dict:
    schedule.validate_season(season)
    return schedule.get_event(season, round)


@router.get(
    "/standings",
    response_model=StandingsResponse,
    summary="Driver & constructor standings with points progression",
)
def standings(
    season: Season,
    round: Annotated[
        int | None, Query(ge=1, le=30, description="Standings after this round")
    ] = None,
) -> dict:
    return standings_svc(season, round)


@router.get(
    "/teammates",
    response_model=TeammateBattleResponse,
    summary="Team-mate head-to-head across the season (from the warehouse)",
)
def teammates(season: Season) -> dict:
    return season_svc.teammate_battle(season)
