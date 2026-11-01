"""In-memory LRU of fully loaded FastF1 sessions.

Loading a session (even from the on-disk FastF1 cache) takes seconds and
hundreds of MB, so each one is loaded exactly once per process and shared
by every endpoint. Concurrent requests for the same session wait on a
per-session lock instead of loading it twice.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import OrderedDict

import fastf1
from fastf1.core import Session

from app.core.config import settings
from app.core.errors import DataUnavailableError
from app.core.observability import span
from app.data.schedule import SessionRef, is_session_in_future

log = logging.getLogger("pitwall.sessions")


class SessionStore:
    def __init__(self, maxsize: int):
        self.maxsize = maxsize
        self._sessions: OrderedDict[tuple, Session] = OrderedDict()
        self._locks: dict[tuple, threading.Lock] = {}
        self._guard = threading.Lock()
        self.load_times: dict[tuple, float] = {}

    def _cached(self, key: tuple) -> Session | None:
        with self._guard:
            session = self._sessions.get(key)
            if session is not None:
                self._sessions.move_to_end(key)
            return session

    def get(self, ref: SessionRef) -> Session:
        key = ref.key
        hit = self._cached(key)
        if hit is not None:
            return hit

        with self._guard:
            lock = self._locks.setdefault(key, threading.Lock())

        with lock:
            hit = self._cached(key)
            if hit is not None:
                return hit
            session = self._load(ref)
            with self._guard:
                self._sessions[key] = session
                self._sessions.move_to_end(key)
                while len(self._sessions) > self.maxsize:
                    evicted, _ = self._sessions.popitem(last=False)
                    log.info("Evicted session %s", evicted)
            # Flatten into the season warehouse (no-op if already there).
            from app.warehouse.store import ingest_in_background

            ingest_in_background(ref, session)
            return session

    def _load(self, ref: SessionRef) -> Session:
        if is_session_in_future(ref):
            raise DataUnavailableError(
                f"{ref.name} for round {ref.round} ({ref.season}) has not happened yet.",
                hint="Pick a completed session.",
            )
        started = time.perf_counter()
        try:
            with span("session.load", season=ref.season, round=ref.round, session=ref.code):
                session = fastf1.get_session(ref.season, ref.round, ref.code)
                session.load(laps=True, telemetry=True, weather=True, messages=True)
        except Exception as exc:
            raise DataUnavailableError(
                f"Timing data for {ref.name} (round {ref.round}, {ref.season}) "
                "could not be loaded.",
                hint="The F1 live-timing archive may be unreachable or the "
                "session has not been published yet.",
            ) from exc

        try:
            laps = session.laps
        except Exception:
            laps = None
        if laps is None or laps.empty:
            raise DataUnavailableError(
                f"No lap data has been published for {ref.name} (round {ref.round}, {ref.season})."
            )
        elapsed = time.perf_counter() - started
        self.load_times[ref.key] = elapsed
        log.info("Loaded session %s in %.1fs", ref.key, elapsed)
        return session

    def loaded_keys(self) -> list[tuple]:
        with self._guard:
            return list(self._sessions.keys())

    def clear(self) -> None:
        with self._guard:
            self._sessions.clear()


store = SessionStore(settings.session_cache_size)
