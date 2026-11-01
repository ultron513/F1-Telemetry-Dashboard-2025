"""Where live-timing messages come from.

* :class:`ArchiveSource` replays a finished session from F1's live-timing
  archive (the same ``.jsonStream`` messages the live feed sent), so live mode
  can be watched, tested and demoed at any speed, any time.
* :class:`F1LiveSource` connects to F1's SignalR live-timing feed during a
  session through FastF1's client, which writes every message to a file that
  is tailed here.

Both yield ``Event(t, topic, data)`` with ``t`` in seconds of session clock.
"""

from __future__ import annotations

import ast
import asyncio
import json
import logging
import tempfile
import threading
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.errors import DataUnavailableError
from app.data.schedule import SessionRef

log = logging.getLogger("pitwall.live")

ARCHIVE_PAGES = {
    "SessionInfo": "session_info",
    "DriverList": "driver_list",
    "TimingData": "timing_data",
    "TimingAppData": "timing_app_data",
    "RaceControlMessages": "race_control_messages",
    "TrackStatus": "track_status",
    "LapCount": "lap_count",
    "WeatherData": "weather_data",
    "SessionStatus": "session_status",
}
REQUIRED = ("DriverList", "TimingData")


@dataclass(frozen=True)
class Event:
    t: float
    topic: str
    data: Any


def clock_seconds(stamp: str) -> float:
    """``"01:36:40.688"`` → 5800.688."""
    h, m, s = stamp.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def format_clock(t: float) -> str:
    h, rem = divmod(max(0.0, t), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


class ArchiveSource:
    """All archived messages for one session, merged into time order."""

    def __init__(self, ref: SessionRef):
        self.ref = ref
        self.events: list[Event] = []

    def load(self) -> ArchiveSource:
        import fastf1
        from fastf1 import _api

        session = fastf1.get_session(self.ref.season, self.ref.round, self.ref.code)
        path = session.api_path
        events: list[Event] = []
        found = set()
        for topic, page in ARCHIVE_PAGES.items():
            try:
                records = _api.fetch_page(path, page)
            except Exception as exc:  # network / cache miss
                log.info("Archive page %s unavailable: %s", page, exc)
                records = None
            if not records:
                continue
            found.add(topic)
            for stamp, data in records:
                try:
                    events.append(Event(clock_seconds(stamp), topic, data))
                except ValueError:
                    continue
        missing = [t for t in REQUIRED if t not in found]
        if missing:
            raise DataUnavailableError(
                f"The live-timing archive for {self.ref.name} is not available.",
                hint="Archived feeds are published shortly after each session; offline mode only has cached sessions.",
            )
        # Stable sort keeps the in-file order of messages with the same timestamp.
        events.sort(key=lambda e: e.t)
        self.events = events
        return self

    @property
    def start(self) -> float:
        """Session clock when the session goes green ("Started"), else the first message."""
        for e in self.events:
            if e.topic == "SessionStatus" and isinstance(e.data, dict) and e.data.get("Status") == "Started":
                return e.t
        return self.events[0].t if self.events else 0.0

    @property
    def end(self) -> float:
        return self.events[-1].t if self.events else 0.0


def parse_live_line(line: str) -> Event | None:
    """Parse one line written by FastF1's SignalR client.

    Feed messages are written as a Python ``repr`` of ``[topic, data, utc]``;
    the initial subscription reply as ``[topic, json_string, ""]``.
    """
    line = line.strip()
    if not line:
        return None
    try:
        msg = ast.literal_eval(line)
    except (ValueError, SyntaxError):
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            return None
    if not isinstance(msg, list) or len(msg) < 2:
        return None
    topic, data = msg[0], msg[1]
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return None
    stamp = msg[2] if len(msg) > 2 else ""
    t = 0.0
    if isinstance(stamp, str) and stamp:
        try:
            t = datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
        except ValueError:
            t = 0.0
    if not isinstance(topic, str):
        return None
    return Event(t, topic, data)


class F1LiveSource:
    """Tails FastF1's SignalR recorder in a background thread."""

    def __init__(self) -> None:
        self.path = Path(tempfile.mkdtemp(prefix="pitwall-live-")) / "feed.txt"
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        from fastf1.livetiming.client import SignalRClient

        client = SignalRClient(str(self.path), timeout=600)
        self._thread = threading.Thread(target=client.start, name="f1-signalr", daemon=True)
        self._thread.start()

    async def events(self) -> AsyncIterator[Event]:
        while not self.path.exists():
            await asyncio.sleep(0.5)
        with self.path.open() as fh:
            while True:
                line = fh.readline()
                if not line:
                    if self._thread and not self._thread.is_alive():
                        return
                    await asyncio.sleep(0.25)
                    continue
                event = parse_live_line(line)
                if event:
                    yield event
