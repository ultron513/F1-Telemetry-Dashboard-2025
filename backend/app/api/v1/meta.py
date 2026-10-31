from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.data.session_store import store
from app.schemas.events import SeasonsResponse

router = APIRouter(tags=["Meta"])


@router.get("/health", summary="Liveness probe")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.version,
        "offline": settings.offline,
        "loaded_sessions": [
            {"season": s, "round": r, "session": c} for s, r, c in store.loaded_keys()
        ],
    }


@router.get("/seasons", response_model=SeasonsResponse, summary="Supported seasons")
def seasons() -> dict:
    return {
        "seasons": list(settings.seasons),
        "default_season": settings.default_season,
    }
