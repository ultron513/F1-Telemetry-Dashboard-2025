"""One-time FastF1 configuration (cache location, logging, offline mode)."""

from __future__ import annotations

import logging
import warnings

import fastf1

from app.core.config import settings

_configured = False


def configure_fastf1() -> None:
    global _configured
    if _configured:
        return

    settings.cache_dir.mkdir(parents=True, exist_ok=True)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        if hasattr(fastf1.Cache, "configure"):
            fastf1.Cache.configure(cache_dir=str(settings.cache_dir))
        else:  # pragma: no cover - older FastF1
            fastf1.Cache.enable_cache(str(settings.cache_dir))

    if settings.offline:
        fastf1.Cache.offline_mode(True)

    fastf1.set_log_level("WARNING")
    logging.getLogger("fastf1").setLevel(logging.WARNING)
    _configured = True
