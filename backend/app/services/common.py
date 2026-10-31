"""Shared helpers for every session-scoped service."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from fastf1.core import Lap, Laps, Session

from app.core.errors import InvalidParameterError, NotFoundError
from app.core.serialize import hex_color, integer, is_missing, num, text

TRACK_STATUS_LABELS = {
    "1": "Green",
    "2": "Yellow",
    "3": "Unknown",
    "4": "Safety Car",
    "5": "Red Flag",
    "6": "VSC",
    "7": "VSC Ending",
}


def drivers(session: Session) -> list[dict[str, Any]]:
    """Every driver in the session with identity + team metadata."""
    results = session.results
    out: list[dict[str, Any]] = []
    for number, row in results.iterrows():
        code = text(row.get("Abbreviation"))
        if not code:
            continue
        out.append(
            {
                "code": code,
                "number": text(row.get("DriverNumber"), str(number)),
                "first_name": text(row.get("FirstName"), ""),
                "last_name": text(row.get("LastName"), ""),
                "full_name": text(row.get("FullName"), code),
                "broadcast_name": text(row.get("BroadcastName"), code),
                "team": text(row.get("TeamName"), "Unknown"),
                "team_color": hex_color(row.get("TeamColor")),
                "country_code": text(row.get("CountryCode")),
                "position": integer(row.get("Position")),
            }
        )
    return out


def driver_lookup(session: Session) -> dict[str, dict[str, Any]]:
    return {d["code"]: d for d in drivers(session)}


def number_to_code(session: Session) -> dict[str, str]:
    return {d["number"]: d["code"] for d in drivers(session)}


def require_driver(session: Session, code: str) -> dict[str, Any]:
    lookup = driver_lookup(session)
    code = code.upper()
    if code not in lookup:
        raise NotFoundError(
            f"Driver '{code}' did not take part in this session.",
            hint=f"Drivers: {', '.join(sorted(lookup))}",
        )
    return lookup[code]


def driver_laps(session: Session, code: str) -> Laps:
    require_driver(session, code)
    laps = session.laps.pick_drivers(code.upper())
    return laps.sort_values("LapNumber")


def resolve_lap(session: Session, code: str, lap: str | int | None) -> Lap:
    """``lap`` may be an int, a numeric string or ``"fastest"``."""
    laps = driver_laps(session, code)
    if laps.empty:
        raise NotFoundError(f"{code.upper()} has no laps in this session.")

    if lap is None or str(lap).lower() in {"fastest", "best", ""}:
        fastest = laps.pick_fastest()
        if fastest is None or (hasattr(fastest, "empty") and fastest.empty):
            # No timed lap (e.g. crashed on lap 1); fall back to longest lap.
            valid = laps[laps["LapTime"].notna()]
            if valid.empty:
                return laps.iloc[0]
            return valid.sort_values("LapTime").iloc[0]
        return fastest

    try:
        number = int(lap)
    except (TypeError, ValueError) as exc:
        raise InvalidParameterError(f"Lap '{lap}' is not a number or 'fastest'.") from exc

    match = laps[laps["LapNumber"] == number]
    if match.empty:
        raise NotFoundError(
            f"{code.upper()} has no lap {number}.",
            hint=f"Laps 1–{int(laps['LapNumber'].max())} are available.",
        )
    return match.iloc[0]


def clean_laps(laps: Laps, threshold: float = 1.07) -> Laps:
    """Representative green-flag laps: no in/out laps, no SC/VSC/red, timed."""
    laps = laps[laps["LapTime"].notna()]
    laps = laps[laps["PitInTime"].isna() & laps["PitOutTime"].isna()]
    if "TrackStatus" in laps.columns:
        status = laps["TrackStatus"].astype(str)
        laps = laps[~status.str.contains("[4567]", regex=True)]
    if "Deleted" in laps.columns:
        laps = laps[laps["Deleted"] != True]  # noqa: E712
    if laps.empty:
        return laps
    best = laps["LapTime"].min()
    return laps[laps["LapTime"] <= best * threshold]


def lap_seconds(laps: Laps) -> np.ndarray:
    return laps["LapTime"].dt.total_seconds().to_numpy(dtype=float)


def status_codes(value: Any) -> list[str]:
    raw = text(value, "") or ""
    return sorted(set(ch for ch in raw if ch.isdigit()))


def team_color_for(session: Session, code: str) -> str | None:
    return driver_lookup(session).get(code, {}).get("team_color")


def total_laps(session: Session) -> int | None:
    value = getattr(session, "total_laps", None)
    if value:
        return int(value)
    laps = session.laps
    if laps.empty:
        return None
    return integer(laps["LapNumber"].max())


def leader_lap_starts(session: Session) -> pd.DataFrame:
    """Session time at which the race leader started each lap."""
    laps = session.laps[["LapNumber", "LapStartTime", "Time"]].dropna(subset=["LapStartTime"])
    if laps.empty:
        return pd.DataFrame(columns=["LapNumber", "LapStartTime"])
    return (
        laps.groupby("LapNumber", as_index=False)["LapStartTime"]
        .min()
        .sort_values("LapNumber")
        .reset_index(drop=True)
    )


def lap_at_session_time(session: Session, t: pd.Timedelta) -> int | None:
    starts = leader_lap_starts(session)
    if starts.empty or is_missing(t):
        return None
    idx = np.searchsorted(starts["LapStartTime"].to_numpy(), np.timedelta64(t), side="right") - 1
    if idx < 0:
        return 0
    return int(starts["LapNumber"].iloc[idx])


def safe_mean(values: np.ndarray) -> float | None:
    values = values[~np.isnan(values)] if len(values) else values
    return num(values.mean()) if len(values) else None
