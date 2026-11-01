"""Operations: background jobs, service status and metrics."""

from __future__ import annotations

import time
from typing import Annotated, Any

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import DomainError, InvalidParameterError, NotFoundError
from app.core.memo import _registry as payload_caches
from app.core.observability import STARTED, metrics, tracing_enabled
from app.data.schedule import validate_season
from app.data.session_store import store
from app.jobs import queue

router = APIRouter(tags=["Operations"])


class Unauthorized(DomainError):
    status_code = 401
    code = "unauthorized"


def _require_admin(token: str | None) -> None:
    if settings.admin_token and token != settings.admin_token:
        raise Unauthorized(
            "This action needs the admin token.", hint="Send it in the X-Admin-Token header."
        )


class IngestRequest(BaseModel):
    season: int = Field(ge=2018, le=2100)
    round: int | None = Field(
        default=None, ge=1, le=30, description="One round, or the whole season"
    )
    sessions: list[str] | None = Field(
        default=None, description="Session codes, e.g. ['Q', 'R']; all by default"
    )
    warm: bool = Field(default=True, description="Pre-compute the heaviest views as well")


@router.post("/jobs/ingest", summary="Queue sessions for download, warehouse ingest and warm-up")
def ingest(
    body: IngestRequest, x_admin_token: Annotated[str | None, Header()] = None
) -> dict[str, Any]:
    _require_admin(x_admin_token)
    validate_season(body.season)
    from app.jobs.tasks import season_sessions

    pairs = season_sessions(body.season, body.sessions)
    if body.round is not None:
        pairs = [p for p in pairs if p[0] == body.round]
    if not pairs:
        raise InvalidParameterError("No completed sessions match that request.")
    q = queue.backend()
    jobs = [
        {
            "id": q.enqueue(
                "ingest_session",
                body.season,
                rnd,
                code,
                body.warm,
                description=f"{body.season} R{rnd} {code}",
            ),
            "round": rnd,
            "session": code,
        }
        for rnd, code in pairs
    ]
    return {"backend": q.name, "queued": len(jobs), "jobs": jobs}


@router.get("/jobs", summary="Recent background jobs")
def jobs(limit: Annotated[int, Query(ge=1, le=200)] = 30) -> dict[str, Any]:
    q = queue.backend()
    return {**q.stats(), "jobs": q.recent(limit)}


@router.get("/jobs/{job_id}", summary="One background job")
def job(job_id: str) -> dict[str, Any]:
    found = queue.backend().get(job_id)
    if not found:
        raise NotFoundError(f"No job '{job_id}'.")
    return found


def status_payload() -> dict[str, Any]:
    from app.warehouse import store as warehouse

    routes = metrics.snapshot()
    total = sum(r["requests"] for r in routes)
    errors = sum(r["errors"] for r in routes)
    q = queue.backend()
    history_files = (
        list(settings.history_cache_dir.glob("*.json"))
        if settings.history_cache_dir.exists()
        else []
    )
    return {
        "service": settings.app_name,
        "version": settings.version,
        "uptime_seconds": round(time.time() - STARTED),
        "offline": settings.offline,
        "tracing": tracing_enabled(),
        "requests": {
            "total": total,
            "errors": errors,
            "by_status": dict(sorted(metrics.status.items())),
        },
        "routes": routes,
        "sessions": {
            "loaded": [
                {
                    "season": s,
                    "round": r,
                    "session": c,
                    "load_seconds": round(store.load_times.get((s, r, c), 0.0), 1),
                }
                for s, r, c in store.loaded_keys()
            ],
            "capacity": store.maxsize,
        },
        "payload_cache": {
            "entries": sum(len(c) for c in payload_caches),
            "caches": len(payload_caches),
        },
        "queue": q.stats(),
        "warehouse": {"sessions": len(warehouse.inventory())},
        "history_cache": {"responses": len(history_files)},
    }


@router.get("/status", summary="Service status for the public status page")
def status() -> dict[str, Any]:
    return status_payload()
