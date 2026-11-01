"""Turns a stream of live-timing events into snapshots, analytics and alerts.

One :class:`LiveEngine` holds the merged timing state for one feed.
:func:`play_archive` drives an engine from an archived session at any speed
(with pause and seek); :class:`LiveHub` shares one engine for the real F1 feed
between every connected viewer.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.live import analytics
from app.live.sources import ArchiveSource, Event, F1LiveSource, format_clock
from app.live.state import LiveState

log = logging.getLogger("pitwall.live")

NEUTRAL = {"4", "5", "6", "7"}
Send = Callable[[dict[str, Any]], Awaitable[None]]


class LiveEngine:
    def __init__(self, pit_loss: float = 22.0, origin: float = 0.0):
        self.state = LiveState()
        self.pace = analytics.PaceTracker()
        self.pit_loss = pit_loss
        self.origin = origin  # session clock of lap 1, for display
        self.prev: dict[str, Any] | None = None
        self._probs: list[dict[str, Any]] = []
        self._probs_key: tuple | None = None

    def feed(self, event: Event) -> None:
        self.state.apply(event.topic, event.data, format_clock(event.t - self.origin))
        if event.topic == "LapCount":
            self.pace.update(self.state.drivers(), self.neutral)

    @property
    def neutral(self) -> bool:
        return self.state.track_status["code"] in NEUTRAL

    def snapshot(self) -> dict[str, Any]:
        rows = self.state.drivers()
        self.pace.update(rows, self.neutral)
        lap, total = self.state.lap, self.state.total_laps
        laps_left = max(0, (total or 0) - (lap or 0)) if total else 0
        key = (lap, tuple((r["number"], r["pit_stops"], r["retired"]) for r in rows))
        if key != self._probs_key:
            self._probs = analytics.probabilities(rows, self.pace, laps_left, self.pit_loss)
            self._probs_key = key
        snap = {
            "type": "snapshot",
            "clock": self.state.clock,
            "session": self.state.session(),
            "lap": lap,
            "total_laps": total,
            "laps_left": laps_left,
            "track_status": self.state.track_status,
            "drivers": rows,
            "race_control": self.state.race_control(),
            "weather": self.state.weather(),
            "pit_loss": self.pit_loss,
            "pit_window": analytics.pit_window(rows, self.pit_loss),
            "probabilities": self._probs,
        }
        snap["alerts"] = analytics.alerts(self.prev, snap)
        self.prev = snap
        return snap


async def play_archive(
    source: ArchiveSource,
    send: Send,
    control: dict[str, Any],
    pit_loss: float,
    tick: float = 1.0,
) -> None:
    """Stream an archived session to one viewer.

    ``control`` is shared with the socket reader: ``speed`` (x real time),
    ``paused`` and ``seek`` (seconds after lap 1 started) can change at any time.
    """
    events = source.events
    origin = source.start

    def build(until: float) -> tuple[LiveEngine, int]:
        engine = LiveEngine(pit_loss, origin)
        i = 0
        while i < len(events) and events[i].t <= until:
            engine.feed(events[i])
            i += 1
        engine.prev = None
        return engine, i

    position = origin + float(control.pop("seek", 0.0) or 0.0)
    engine, i = build(position)
    first = engine.snapshot()
    first["alerts"] = []
    await send({**first, "replay": _replay_meta(source, position, control)})

    last = time.monotonic()
    while True:
        await asyncio.sleep(tick)
        now = time.monotonic()
        dt, last = now - last, now
        if "seek" in control:
            position = origin + float(control.pop("seek") or 0.0)
            engine, i = build(position)
            snap = engine.snapshot()
            snap["alerts"] = []
            await send({**snap, "replay": _replay_meta(source, position, control)})
            continue
        if control.get("paused"):
            continue
        position += dt * float(control.get("speed", 1.0))
        while i < len(events) and events[i].t <= position:
            engine.feed(events[i])
            i += 1
        snap = engine.snapshot()
        await send({**snap, "replay": _replay_meta(source, position, control)})
        if i >= len(events):
            await send({"type": "end"})
            return


def _replay_meta(source: ArchiveSource, position: float, control: dict[str, Any]) -> dict[str, Any]:
    return {
        "position": round(position - source.start, 1),
        "duration": round(source.end - source.start, 1),
        "speed": control.get("speed", 1.0),
        "paused": bool(control.get("paused")),
    }


class LiveHub:
    """One shared engine for the real F1 feed, fanned out to every socket."""

    def __init__(self, pit_loss: float = 22.0):
        self.pit_loss = pit_loss
        self.subscribers: set[asyncio.Queue] = set()
        self.engine: LiveEngine | None = None
        self._task: asyncio.Task | None = None
        self.started_at: float | None = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=5)
        self.subscribers.add(q)
        if not self.running:
            self._task = asyncio.create_task(self._run())
        elif self.engine and self.engine.prev:
            q.put_nowait({**self.engine.prev, "alerts": []})
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)

    async def _broadcast(self, msg: dict[str, Any]) -> None:
        for q in list(self.subscribers):
            if q.full():
                try:
                    q.get_nowait()  # slow client: drop the oldest frame
                except asyncio.QueueEmpty:
                    pass
            q.put_nowait(msg)

    async def _run(self) -> None:
        source = F1LiveSource()
        source.start()
        self.engine = LiveEngine(self.pit_loss)
        self.started_at = time.time()
        last = 0.0
        try:
            async for event in source.events():
                self.engine.feed(event)
                now = time.monotonic()
                if now - last >= 1.0:
                    last = now
                    await self._broadcast(self.engine.snapshot())
                if not self.subscribers:
                    log.info("No live viewers left; keeping the feed open for late joiners")
        except Exception:  # pragma: no cover - network failures
            log.exception("Live feed stopped")
            await self._broadcast({"type": "error", "message": "The live feed disconnected."})


hub = LiveHub()
