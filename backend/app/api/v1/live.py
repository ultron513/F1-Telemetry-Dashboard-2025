"""Live race mode over WebSockets.

``/live/ws?mode=archive&season=2025&round=3&session=R&speed=20`` replays an
archived session as if it were live (pause / seek / speed from the client);
``/live/ws?mode=live`` streams the real F1 feed during a session.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app.api import payloads
from app.core.config import settings
from app.core.errors import DomainError
from app.data.schedule import list_events, resolve_session
from app.live.engine import hub, play_archive
from app.live.sources import ArchiveSource

router = APIRouter(prefix="/live", tags=["Live"])
log = logging.getLogger("pitwall.live")

DEFAULT_PIT_LOSS = 22.0
LIVE_WINDOW_BEFORE = timedelta(minutes=15)
LIVE_WINDOW_AFTER = timedelta(hours=3)


def _session_window(now: datetime) -> dict[str, Any]:
    """The session running now (if any) and the next one."""
    current = None
    upcoming = None
    for season in sorted({now.year, now.year + 1} & set(settings.seasons)):
        try:
            events = list_events(season)
        except DomainError:
            continue
        for event in events:
            for s in event["sessions"]:
                if not s.get("start_utc"):
                    continue
                start = datetime.fromisoformat(s["start_utc"].replace("Z", "+00:00"))
                item = {
                    "season": season,
                    "round": event["round"],
                    "event": event["name"],
                    "session": s["code"],
                    "name": s["name"],
                    "start_utc": s["start_utc"],
                }
                if start - LIVE_WINDOW_BEFORE <= now <= start + LIVE_WINDOW_AFTER:
                    current = item
                elif start > now and (upcoming is None or s["start_utc"] < upcoming["start_utc"]):
                    upcoming = item
    return {"now_utc": now.isoformat(), "live": current, "next": upcoming}


@router.get("/status", summary="Is a session live right now?")
def status() -> dict[str, Any]:
    window = _session_window(datetime.now(UTC))
    window["feed_running"] = hub.running
    window["viewers"] = len(hub.subscribers)
    return window


def _pit_loss(season: int, rnd: int, code: str) -> float:
    try:
        data = payloads.strategy(resolve_session(season, rnd, code))
        return float(data["pit_loss"] or (data["median_pit_lane"] or 20.0) + 2.0)
    except Exception:  # session not loadable: fall back to a typical value
        return DEFAULT_PIT_LOSS


async def _reader(ws: WebSocket, control: dict[str, Any]) -> None:
    while True:
        msg = await ws.receive_json()
        if not isinstance(msg, dict):
            continue
        if "speed" in msg:
            control["speed"] = max(0.25, min(120.0, float(msg["speed"])))
        if "paused" in msg:
            control["paused"] = bool(msg["paused"])
        if "seek" in msg:
            control["seek"] = max(0.0, float(msg["seek"]))


@router.websocket("/ws")
async def live_socket(
    ws: WebSocket,
    mode: str = Query("archive", pattern="^(archive|live)$"),
    season: int | None = None,
    rnd: int | None = Query(None, alias="round"),
    session: str | None = None,
    speed: float = Query(1.0, ge=0.25, le=120.0),
    start: float = Query(0.0, ge=0.0, description="Seconds after lap 1 to start from"),
) -> None:
    await ws.accept()

    async def send(msg: dict[str, Any]) -> None:
        await ws.send_json(msg)

    try:
        if mode == "live":
            queue = hub.subscribe()
            await send({"type": "hello", "mode": "live"})
            try:
                while True:
                    await send(await queue.get())
            finally:
                hub.unsubscribe(queue)
            return

        if not (season and rnd and session):
            await send({"type": "error", "message": "season, round and session are required."})
            await ws.close()
            return
        try:
            ref = resolve_session(season, rnd, session.upper())
            source = await run_in_threadpool(ArchiveSource(ref).load)
            pit_loss = await run_in_threadpool(_pit_loss, season, rnd, ref.code)
        except DomainError as exc:
            await send({"type": "error", "message": exc.message, "hint": exc.hint})
            await ws.close()
            return

        await send(
            {
                "type": "hello",
                "mode": "archive",
                "session": {"season": season, "round": rnd, "code": ref.code, "name": ref.name},
                "duration": round(source.end - source.start, 1),
                "pit_loss": pit_loss,
            }
        )
        control: dict[str, Any] = {"speed": speed, "paused": False, "seek": start}
        reader = asyncio.create_task(_reader(ws, control))
        player = asyncio.create_task(play_archive(source, send, control, pit_loss))
        done, pending = await asyncio.wait({reader, player}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                raise exc
    except WebSocketDisconnect:
        return
