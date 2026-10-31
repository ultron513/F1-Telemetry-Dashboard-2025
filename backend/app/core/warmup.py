"""Pre-load the most recent races in the background after startup.

On hosts whose disk is wiped on restart (e.g. Hugging Face Spaces), this
means the sessions people are most likely to open are already downloaded
and in memory by the time the first visitor arrives.
"""

from __future__ import annotations

import logging
import threading
import time

from app.core.config import settings

log = logging.getLogger("pitwall.warmup")


def _warm() -> None:
    # Imported lazily so app startup is never blocked by these modules.
    from app.api import payloads
    from app.data.schedule import current_season, list_events, resolve_session

    started = time.perf_counter()
    season = current_season()
    try:
        events = [e for e in list_events(season) if e["status"] == "completed"]
    except Exception as exc:  # calendar unreachable
        log.warning("Warm-up skipped: %s", exc)
        return
    for event in reversed(events[-settings.warm_events :]):
        codes = [s["code"] for s in event["sessions"]]
        for code in ("R", "Q"):
            if code not in codes:
                continue
            try:
                ref = resolve_session(season, event["round"], code)
                payloads.summary(ref)
                payloads.circuit(ref)
                if code == "R":
                    payloads.strategy(ref)
                log.info("Warmed %s", ref.key)
            except Exception as exc:
                log.warning("Could not warm round %s %s: %s", event["round"], code, exc)
    log.info("Warm-up finished in %.0fs", time.perf_counter() - started)


def start_warmup() -> None:
    if settings.warm not in {"1", "true", "yes", "latest"}:
        return
    threading.Thread(target=_warm, name="pitwall-warmup", daemon=True).start()
