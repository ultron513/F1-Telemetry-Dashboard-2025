"""Race-control feed classification and the track-status timeline."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd
from fastf1.core import Session

from app.core.serialize import integer, is_missing, iso_utc, num, text
from app.services import common

FLAG_KINDS = {
    "RED": "red",
    "YELLOW": "yellow",
    "DOUBLE YELLOW": "double_yellow",
    "GREEN": "green",
    "CLEAR": "clear",
    "BLUE": "blue",
    "CHEQUERED": "chequered",
    "BLACK AND WHITE": "black_white",
    "BLACK AND ORANGE": "black_orange",
}

SEVERITY = {
    "red": "critical",
    "sc": "critical",
    "black_white": "high",
    "black_orange": "high",
    "penalty": "high",
    "vsc": "high",
    "double_yellow": "high",
    "yellow": "medium",
    "investigation": "medium",
    "weather": "medium",
    "track_limits": "low",
    "blue": "low",
    "drs": "low",
    "pit": "low",
    "green": "info",
    "clear": "info",
    "chequered": "info",
    "info": "info",
}

_CAR_RE = re.compile(r"CARS? ((?:\d+ \([A-Z]{3}\)(?:,? (?:AND )?)?)+)")
_CODE_RE = re.compile(r"\(([A-Z]{3})\)")


def classify(category: str, flag: str, message: str) -> str:
    msg = message.upper()
    cat = category.upper()
    if cat == "FLAG" and flag.upper() in FLAG_KINDS:
        return FLAG_KINDS[flag.upper()]
    if cat == "SAFETYCAR" or "SAFETY CAR" in msg:
        return "vsc" if "VIRTUAL" in msg or "VSC" in msg else "sc"
    if cat == "DRS" or msg.startswith("DRS"):
        return "drs"
    if "PENALTY" in msg and "NO FURTHER" not in msg:
        return "penalty"
    if "TRACK LIMITS" in msg or "DELETED" in msg:
        return "track_limits"
    if any(k in msg for k in ("INVESTIGATION", "NOTED", "REVIEWED", "SUMMONED")):
        return "investigation"
    if "RAIN" in msg or "WET" in msg:
        return "weather"
    if "PIT" in msg:
        return "pit"
    if "CHEQUERED" in msg:
        return "chequered"
    if "RED FLAG" in msg:
        return "red"
    return "info"


def _title(kind: str, status: str | None) -> str:
    titles = {
        "red": "Red Flag",
        "sc": "Safety Car",
        "vsc": "Virtual Safety Car",
        "yellow": "Yellow Flag",
        "double_yellow": "Double Yellow",
        "green": "Green Flag",
        "clear": "Track Clear",
        "blue": "Blue Flag",
        "chequered": "Chequered Flag",
        "black_white": "Black & White Flag",
        "black_orange": "Black & Orange Flag",
        "penalty": "Penalty",
        "investigation": "Stewards",
        "track_limits": "Track Limits",
        "drs": "DRS",
        "weather": "Weather",
        "pit": "Pit Lane",
        "info": "Race Control",
    }
    base = titles.get(kind, "Race Control")
    if status and kind in {"sc", "vsc", "drs"}:
        return f"{base} {status.title()}"
    return base


def messages(session: Session) -> list[dict[str, Any]]:
    rcm = getattr(session, "race_control_messages", None)
    if rcm is None or rcm.empty:
        return []
    num_to_code = common.number_to_code(session)
    t0 = getattr(session, "t0_date", None)
    out = []
    for i, row in rcm.reset_index(drop=True).iterrows():
        message = text(row.get("Message"), "") or ""
        category = text(row.get("Category"), "Other") or "Other"
        flag = text(row.get("Flag"), "") or ""
        status = text(row.get("Status"))
        kind = classify(category, flag, message)
        drivers = list(dict.fromkeys(_CODE_RE.findall(message)))
        racing_number = text(row.get("RacingNumber"))
        if racing_number and racing_number in num_to_code:
            code = num_to_code[racing_number]
            if code not in drivers:
                drivers.insert(0, code)
        session_time = None
        ts = row.get("Time")
        if t0 is not None and not is_missing(ts):
            try:
                session_time = num((pd.Timestamp(ts) - pd.Timestamp(t0)).total_seconds(), 1)
            except Exception:
                session_time = None
        out.append(
            {
                "id": i,
                "time_utc": iso_utc(ts),
                "session_time": session_time,
                "lap": integer(row.get("Lap")),
                "category": category,
                "kind": kind,
                "severity": SEVERITY.get(kind, "info"),
                "title": _title(kind, status),
                "message": message,
                "flag": flag or None,
                "status": status,
                "scope": text(row.get("Scope")),
                "sector": integer(row.get("Sector")),
                "drivers": drivers,
            }
        )
    return out


def track_status_timeline(session: Session) -> list[dict[str, Any]]:
    ts = getattr(session, "track_status", None)
    if ts is None or ts.empty:
        return []
    rows = ts.reset_index(drop=True)
    end_time = session.laps["Time"].max() if not session.laps.empty else None
    segments = []
    for i, row in rows.iterrows():
        status = text(row.get("Status"), "1") or "1"
        start = row["Time"]
        stop = rows.loc[i + 1, "Time"] if i + 1 < len(rows) else end_time
        if is_missing(stop) or is_missing(start):
            continue
        if segments and segments[-1]["status"] == status:
            segments[-1]["end"] = num(stop.total_seconds(), 1)
            segments[-1]["end_lap"] = common.lap_at_session_time(session, stop)
            continue
        segments.append(
            {
                "status": status,
                "label": common.TRACK_STATUS_LABELS.get(status, status),
                "start": num(start.total_seconds(), 1),
                "end": num(stop.total_seconds(), 1),
                "start_lap": common.lap_at_session_time(session, start),
                "end_lap": common.lap_at_session_time(session, stop),
            }
        )
    return segments


def race_control(session: Session) -> dict[str, Any]:
    msgs = messages(session)
    counts: dict[str, int] = {}
    for m in msgs:
        counts[m["kind"]] = counts.get(m["kind"], 0) + 1
    timeline = track_status_timeline(session)
    laps = session.laps
    start = laps["LapStartTime"].min() if not laps.empty else None
    end = laps["Time"].max() if not laps.empty else None
    return {
        "messages": msgs,
        "counts": counts,
        "track_status": timeline,
        "session_window": {
            "start": num(start.total_seconds(), 1)
            if start is not None and not is_missing(start)
            else None,
            "end": num(end.total_seconds(), 1) if end is not None and not is_missing(end) else None,
        },
        "total_laps": common.total_laps(session),
    }
