"""Cache-Control policy for API responses.

Completed sessions never change, so their payloads are safe to cache for a
long time in browsers and, more importantly, on the CDN in front of the API
(the Vercel proxy). Recent sessions, calendars and standings get short TTLs.
"""

from __future__ import annotations

from fastapi import FastAPI, Request

LONG = "public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400"
RECENT = "public, max-age=60, s-maxage=300, stale-while-revalidate=60"
CALENDAR = "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600"
STATIC = "public, max-age=86400, s-maxage=86400"
NO_STORE = "no-store"


def policy_for(path: str, recent: bool | None) -> str:
    if path.endswith("/health"):
        return NO_STORE
    if path.startswith("/api/v1/sessions/"):
        return RECENT if recent or recent is None else LONG
    if path == "/api/v1/seasons":
        return STATIC
    if path.startswith("/api/v1/seasons/"):
        return CALENDAR
    return NO_STORE


def register_cache_headers(app: FastAPI) -> None:
    @app.middleware("http")
    async def _cache_control(request: Request, call_next):
        response = await call_next(request)
        if "cache-control" in response.headers:
            return response
        if request.method != "GET" or response.status_code != 200:
            response.headers["Cache-Control"] = NO_STORE
            return response
        recent = getattr(request.state, "session_recent", None)
        response.headers["Cache-Control"] = policy_for(request.url.path, recent)
        return response
