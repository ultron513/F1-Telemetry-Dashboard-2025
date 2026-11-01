"""Job bodies. Plain functions, so RQ workers and the in-process queue run the same code."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.core.observability import span

log = logging.getLogger("pitwall.jobs")

WARM_PAYLOADS = ("summary", "circuit", "strategy", "race_trace", "field_pace", "ratings")


def ingest_session(season: int, round_number: int, code: str, warm: bool = True) -> dict[str, Any]:
    """Load one session (downloads into the FastF1 cache), add it to the
    warehouse and pre-compute the heaviest payloads."""
    from app.api import payloads
    from app.data.schedule import resolve_session
    from app.data.session_store import store
    from app.warehouse import store as warehouse

    started = time.perf_counter()
    with span("job.ingest_session", season=season, round=round_number, session=code):
        ref = resolve_session(season, round_number, code)
        session = store.get(ref)
        added = warehouse.ingest(ref, session)
        warmed = []
        if warm:
            for name in WARM_PAYLOADS:
                fn = getattr(payloads, name)
                try:
                    fn(ref)
                    warmed.append(name)
                except Exception as exc:  # e.g. strategy on a practice session
                    log.debug("Skip warming %s: %s", name, exc)
    return {
        "season": season,
        "round": round_number,
        "session": ref.code,
        "warehouse": "added" if added else "already present",
        "warmed": warmed,
        "seconds": round(time.perf_counter() - started, 1),
    }


def season_sessions(season: int, sessions: list[str] | None = None) -> list[tuple[int, str]]:
    """Completed (round, session) pairs in a season, optionally filtered by code."""
    from datetime import UTC, datetime

    from app.data.schedule import list_events

    wanted = {s.upper() for s in sessions} if sessions else None
    now = datetime.now(UTC)
    out = []
    for event in list_events(season):
        for s in event["sessions"]:
            if wanted and s["code"] not in wanted:
                continue
            start = s.get("start_utc")
            if start and datetime.fromisoformat(start.replace("Z", "+00:00")) > now:
                continue
            out.append((event["round"], s["code"]))
    return out
