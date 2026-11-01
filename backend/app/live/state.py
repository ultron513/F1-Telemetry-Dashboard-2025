"""Live timing state built from F1 live-timing messages.

The F1 feed (both the live SignalR stream and the archived ``.jsonStream``
files) sends one full object per topic, then *partial patches*: nested dicts
that only contain what changed. Lists are patched with dicts keyed by index
(``{"Stints": {"1": {"TotalLaps": 7}}}``). :func:`merge` applies those rules,
and :class:`LiveState` turns the merged topics into a clean timing snapshot.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

TOPICS = (
    "DriverList",
    "TimingData",
    "TimingAppData",
    "RaceControlMessages",
    "TrackStatus",
    "LapCount",
    "WeatherData",
    "SessionInfo",
    "SessionStatus",
    "ExtrapolatedClock",
)

TRACK_STATUS = {
    "1": "Green",
    "2": "Yellow",
    "3": "Unknown",
    "4": "Safety Car",
    "5": "Red Flag",
    "6": "VSC",
    "7": "VSC Ending",
}


def merge(base: Any, patch: Any) -> Any:
    """Deep-merge an F1 live-timing patch into ``base`` (returns the result)."""
    if isinstance(patch, dict):
        if isinstance(base, list):
            out = list(base)
            for key, value in patch.items():
                if key == "_deleted":
                    continue
                try:
                    idx = int(key)
                except (TypeError, ValueError):
                    continue
                while len(out) <= idx:
                    out.append({})
                out[idx] = merge(out[idx], value)
            return out
        out = dict(base) if isinstance(base, dict) else {}
        for key, value in patch.items():
            if key == "_deleted":
                for gone in value or []:
                    out.pop(str(gone), None)
                continue
            out[key] = merge(out.get(key), value)
        return out
    return patch


_LAP_TIME = re.compile(r"^(?:(\d+):)?(\d+(?:\.\d+)?)$")


def lap_seconds(text: Any) -> float | None:
    """``"1:33.079"`` → 93.079."""
    if not isinstance(text, str) or not text:
        return None
    m = _LAP_TIME.match(text.strip())
    if not m:
        return None
    return int(m.group(1) or 0) * 60 + float(m.group(2))


def gap_value(text: Any) -> tuple[float | None, int]:
    """Parse a gap string. Returns (seconds, laps behind).

    ``"+1.234"`` → (1.234, 0); ``"1L"`` / ``"2 LAPS"`` → (None, 1|2);
    ``"LAP 12"`` (the leader's own row) → (0.0, 0).
    """
    if isinstance(text, dict):
        text = text.get("Value")
    if not isinstance(text, str) or not text.strip():
        return None, 0
    t = text.strip().upper()
    if t.startswith("LAP"):
        return 0.0, 0
    m = re.match(r"^\+?(\d+)\s*L(?:AP|APS)?$", t)
    if m:
        return None, int(m.group(1))
    try:
        return float(t.lstrip("+")), 0
    except ValueError:
        return None, 0


@dataclass
class LiveState:
    topics: dict[str, Any] = field(default_factory=dict)
    clock: str = "00:00:00.000"
    messages_seen: int = 0

    def apply(self, topic: str, data: Any, clock: str | None = None) -> None:
        topic = topic.removesuffix(".z")
        if topic not in TOPICS:
            return
        if topic == "RaceControlMessages" and isinstance(data, dict):
            # Messages arrive as a full list first, then as {"N": message}.
            current = self.topics.get(topic, {"Messages": []})
            msgs = data.get("Messages")
            if isinstance(msgs, list):
                current = {"Messages": list(current.get("Messages", [])) + msgs}
            elif isinstance(msgs, dict):
                current = {"Messages": merge(current.get("Messages", []), msgs)}
            self.topics[topic] = current
        else:
            self.topics[topic] = merge(self.topics.get(topic), data)
        if clock:
            self.clock = clock
        self.messages_seen += 1

    # -- derived views -----------------------------------------------------

    @property
    def lap(self) -> int | None:
        return self.topics.get("LapCount", {}).get("CurrentLap")

    @property
    def total_laps(self) -> int | None:
        return self.topics.get("LapCount", {}).get("TotalLaps")

    @property
    def track_status(self) -> dict[str, str]:
        ts = self.topics.get("TrackStatus", {})
        code = str(ts.get("Status", "1"))
        return {"code": code, "label": TRACK_STATUS.get(code, "Unknown")}

    def race_control(self, limit: int = 30) -> list[dict[str, Any]]:
        msgs = [m for m in self.topics.get("RaceControlMessages", {}).get("Messages", []) if m]
        out = []
        for m in msgs[-limit:]:
            out.append(
                {
                    "utc": m.get("Utc"),
                    "lap": m.get("Lap"),
                    "category": m.get("Category"),
                    "flag": m.get("Flag"),
                    "scope": m.get("Scope"),
                    "message": m.get("Message", ""),
                }
            )
        return out

    def weather(self) -> dict[str, Any] | None:
        w = self.topics.get("WeatherData")
        if not w:
            return None

        def f(key: str) -> float | None:
            try:
                return float(w.get(key))
            except (TypeError, ValueError):
                return None

        return {
            "air": f("AirTemp"),
            "track": f("TrackTemp"),
            "humidity": f("Humidity"),
            "wind": f("WindSpeed"),
            "rain": (f("Rainfall") or 0) > 0,
        }

    def session(self) -> dict[str, Any]:
        info = self.topics.get("SessionInfo", {})
        meeting = info.get("Meeting", {})
        return {
            "name": info.get("Name"),
            "type": info.get("Type"),
            "meeting": meeting.get("Name"),
            "circuit": meeting.get("Circuit", {}).get("ShortName"),
            "status": self.topics.get("SessionStatus", {}).get("Status"),
        }

    def drivers(self) -> list[dict[str, Any]]:
        """Timing tower rows, in running order."""
        driver_list = self.topics.get("DriverList", {})
        timing = self.topics.get("TimingData", {}).get("Lines", {})
        app = self.topics.get("TimingAppData", {}).get("Lines", {})
        rows = []
        for number, t in timing.items():
            if not isinstance(t, dict):
                continue
            info = driver_list.get(number, {}) if isinstance(driver_list, dict) else {}
            stints = [s for s in (app.get(number, {}) or {}).get("Stints", []) if s]
            current = stints[-1] if stints else {}
            compounds = {s.get("Compound") for s in stints if s.get("Compound")}
            gap, laps_down = gap_value(t.get("GapToLeader"))
            interval, _ = gap_value(t.get("IntervalToPositionAhead"))
            try:
                position = int(t.get("Position") or info.get("Line") or 99)
            except ValueError:
                position = 99
            if position == 1 and gap is None and not laps_down:
                gap = 0.0  # the leader's own gap is blank or "LAP n"
            last = t.get("LastLapTime") or {}
            best = t.get("BestLapTime") or {}
            age = None
            if current:
                age = int(current.get("StartLaps") or 0) + int(current.get("TotalLaps") or 0)
            rows.append(
                {
                    "number": number,
                    "code": info.get("Tla") or number,
                    "name": info.get("FullName") or info.get("BroadcastName") or number,
                    "team": info.get("TeamName"),
                    "team_color": f"#{info['TeamColour']}" if info.get("TeamColour") else None,
                    "position": position,
                    "gap": gap,
                    "laps_down": laps_down,
                    "interval": interval,
                    "laps": t.get("NumberOfLaps"),
                    "last_lap": lap_seconds(last.get("Value")),
                    "last_lap_personal_best": bool(last.get("PersonalFastest")),
                    "last_lap_overall_best": bool(last.get("OverallFastest")),
                    "best_lap": lap_seconds(best.get("Value")),
                    "in_pit": bool(t.get("InPit")),
                    "pit_out": bool(t.get("PitOut")),
                    "pit_stops": int(t.get("NumberOfPitStops") or 0),
                    "retired": bool(t.get("Retired")) or bool(t.get("Stopped")),
                    "compound": current.get("Compound"),
                    "tyre_age": age,
                    "new_tyre": str(current.get("New", "")).lower() == "true",
                    "compounds_used": sorted(
                        c for c in compounds if c not in {"UNKNOWN", "TEST_UNKNOWN"}
                    ),
                }
            )
        rows.sort(key=lambda r: (r["retired"], r["position"]))
        return rows
