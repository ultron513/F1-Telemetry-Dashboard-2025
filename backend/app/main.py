"""FastAPI application factory."""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import PlainTextResponse

from app.api.v1 import events, history, live, meta, ops, sessions
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.fastf1_setup import configure_fastf1
from app.core.observability import MetricsMiddleware, setup_tracing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)


def create_app() -> FastAPI:
    configure_fastf1()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "Formula 1 timing, telemetry and strategy analytics built on FastF1. "
            "All session endpoints live under "
            "`/api/v1/sessions/{season}/{round}/{session}`."
        ),
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        max_age=86400,
    )
    register_error_handlers(app)

    v1 = APIRouter(prefix="/api/v1")
    v1.include_router(meta.router)
    v1.include_router(events.router)
    v1.include_router(sessions.router)
    v1.include_router(live.router)
    v1.include_router(history.router)
    v1.include_router(ops.router)
    app.include_router(v1)

    app.add_middleware(MetricsMiddleware)
    setup_tracing(app)

    @app.get("/metrics", include_in_schema=False, response_class=PlainTextResponse)
    def prometheus() -> str:
        from app.core.observability import metrics

        data = ops.status_payload()
        return metrics.prometheus(
            {
                "uptime_seconds": data["uptime_seconds"],
                "sessions_loaded": len(data["sessions"]["loaded"]),
                "payload_cache_entries": data["payload_cache"]["entries"],
                "warehouse_sessions": data["warehouse"]["sessions"],
            }
        )

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"service": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}

    return app


app = create_app()
