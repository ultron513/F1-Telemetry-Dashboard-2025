"""Runtime configuration, resolved once from environment variables.

Every knob that differs between local development and a deployed
container lives here so the rest of the code base never touches
``os.environ`` directly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    try:
        return int(raw) if raw is not None else default
    except ValueError:
        return default


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


def _env_seasons(name: str, default: tuple[int, ...]) -> tuple[int, ...]:
    raw = os.getenv(name)
    if not raw:
        return default
    seasons = sorted({int(s) for s in raw.split(",") if s.strip().isdigit()})
    return tuple(seasons) or default


@dataclass(frozen=True)
class Settings:
    app_name: str = "Pit Wall Telemetry API"
    version: str = "2.0.0"

    cache_dir: Path = field(
        default_factory=lambda: Path(os.getenv("F1_CACHE_DIR", str(PROJECT_ROOT / "cache")))
    )
    offline: bool = field(default_factory=lambda: _env_bool("F1_OFFLINE", False))
    session_cache_size: int = field(
        default_factory=lambda: max(1, _env_int("F1_SESSION_CACHE_SIZE", 3))
    )

    seasons: tuple[int, ...] = field(
        default_factory=lambda: _env_seasons("F1_SEASONS", (2023, 2024, 2025, 2026))
    )
    default_season: int = field(default_factory=lambda: _env_int("F1_DEFAULT_SEASON", 2025))
    # When F1_DEFAULT_SEASON isn't set, open on the newest season that has a finished race.
    default_season_pinned: bool = field(
        default_factory=lambda: bool(os.getenv("F1_DEFAULT_SEASON"))
    )

    cors_origins: list[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )
    )
    # Matches Vercel preview + production deployments by default.
    cors_origin_regex: str | None = field(
        default_factory=lambda: os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app") or None
    )

    jolpica_base_url: str = field(
        default_factory=lambda: os.getenv(
            "JOLPICA_BASE_URL", "https://api.jolpi.ca/ergast/f1"
        ).rstrip("/")
    )
    http_timeout: float = 12.0

    # Background pre-load of the most recent races at startup ("" = off).
    warm: str = field(default_factory=lambda: os.getenv("F1_WARM", "").strip().lower())
    warm_events: int = field(default_factory=lambda: max(1, _env_int("F1_WARM_EVENTS", 2)))

    # Payload caches for derived (already-serialised) results.
    payload_cache_size: int = field(default_factory=lambda: _env_int("F1_PAYLOAD_CACHE_SIZE", 512))
    payload_cache_ttl: int = field(
        default_factory=lambda: _env_int("F1_PAYLOAD_CACHE_TTL", 6 * 3600)
    )


settings = Settings()
