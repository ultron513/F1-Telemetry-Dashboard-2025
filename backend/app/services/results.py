"""Session classification and the headline summary used by the overview page."""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Session

from app.core.serialize import hex_color, integer, num, seconds, text
from app.data.schedule import SessionRef, get_event
from app.services import common

RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1]


def is_retirement(status: str | None) -> bool:
    if not status:
        return False
    return status not in {"Finished", "Lapped"} and not status.startswith("+")


def _fmt_gap(value: float | None) -> str | None:
    if value is None:
        return None
    return f"+{value:.3f}s"


def _fmt_total(value: float | None) -> str | None:
    if value is None:
        return None
    hours, rem = divmod(value, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{int(hours)}:{int(minutes):02d}:{secs:06.3f}"
    return f"{int(minutes)}:{secs:06.3f}"


def _best_laps(session: Session) -> dict[str, dict[str, Any]]:
    laps = session.laps
    timed = laps[laps["LapTime"].notna()]
    if "Deleted" in timed.columns:
        timed = timed[timed["Deleted"] != True]  # noqa: E712
    out: dict[str, dict[str, Any]] = {}
    for code, group in timed.groupby("Driver"):
        best = group.sort_values("LapTime").iloc[0]
        out[str(code)] = {
            "time": seconds(best["LapTime"]),
            "lap": integer(best["LapNumber"]),
            "compound": text(best.get("Compound")),
        }
    return out


def _quali_parts(session: Session) -> dict[str, dict[str, float | None]]:
    """Fallback Q1/Q2/Q3 bests derived from lap timing."""
    out: dict[str, dict[str, float | None]] = {}
    try:
        parts = session.laps.split_qualifying_sessions()
    except Exception:
        return out
    for label, part in zip(("q1", "q2", "q3"), parts):
        if part is None or part.empty:
            continue
        timed = part[part["LapTime"].notna()]
        if "Deleted" in timed.columns:
            timed = timed[timed["Deleted"] != True]  # noqa: E712
        for code, group in timed.groupby("Driver"):
            out.setdefault(str(code), {})[label] = seconds(group["LapTime"].min())
    return out


def _race_finish_times(session: Session) -> dict[str, tuple[int, float | None]]:
    """(laps completed, session time at the end of the last lap) per driver."""
    out: dict[str, tuple[int, float | None]] = {}
    for code, group in session.laps.groupby("Driver"):
        group = group.sort_values("LapNumber")
        last = group.iloc[-1]
        out[str(code)] = (integer(last["LapNumber"]) or 0, seconds(last["Time"]))
    return out


def classification(ref: SessionRef, session: Session) -> list[dict[str, Any]]:
    results = session.results.copy()
    bests = _best_laps(session)
    kind = ref.kind
    fastest_code = None
    if bests:
        fastest_code = min(
            (c for c in bests if bests[c]["time"] is not None),
            key=lambda c: bests[c]["time"],
            default=None,
        )

    finish = _race_finish_times(session) if kind == "race" else {}
    winner_laps = max((v[0] for v in finish.values()), default=0)
    winner_time = None
    if finish:
        leaders = [v for v in finish.values() if v[0] == winner_laps and v[1] is not None]
        winner_time = min((v[1] for v in leaders), default=None)

    quali_fallback = _quali_parts(session) if kind == "qualifying" else {}
    have_points = results["Points"].notna().any() if "Points" in results else False
    table = SPRINT_POINTS if ref.code == "S" else RACE_POINTS

    if results["Position"].notna().any():
        results = results.sort_values("Position", na_position="last")

    session_best = bests.get(fastest_code, {}).get("time") if fastest_code else None
    rows: list[dict[str, Any]] = []

    for idx, (number, row) in enumerate(results.iterrows()):
        code = text(row.get("Abbreviation"))
        if not code:
            continue
        position = integer(row.get("Position")) or (idx + 1)
        best = bests.get(code, {})
        laps_done, last_time = finish.get(code, (integer(row.get("Laps")) or 0, None))

        status = text(row.get("Status"))
        points = num(row.get("Points"), 1)
        time_text: str | None = None
        gap: float | None = None

        if kind == "race":
            result_time = seconds(row.get("Time"))
            if laps_done and winner_laps:
                down = winner_laps - laps_done
                if status is None:
                    if down == 0:
                        status = "Finished"
                    elif down <= 3:
                        status = f"+{down} Lap{'s' if down > 1 else ''}"
                    else:
                        status = "Retired"
            if position == 1:
                if result_time is None and last_time is not None:
                    start = session.laps["LapStartTime"].min()
                    result_time = (
                        round(last_time - start.total_seconds(), 3)
                        if not common.is_missing(start)
                        else None
                    )
                time_text = _fmt_total(result_time) if result_time else None
                gap = 0.0
            elif result_time is not None:
                gap = result_time
                time_text = _fmt_gap(result_time)
            elif status == "Finished" and last_time is not None and winner_time is not None:
                gap = round(last_time - winner_time, 3)
                time_text = _fmt_gap(gap)
            else:
                time_text = status
            if not have_points:
                pts = table[position - 1] if position - 1 < len(table) else 0
                if is_retirement(status):
                    pts = 0
                if (
                    ref.code == "R"
                    and 2019 <= ref.season <= 2024
                    and code == fastest_code
                    and position <= 10
                ):
                    pts += 1
                points = float(pts)
        else:
            if best.get("time") is not None and session_best is not None:
                gap = round(best["time"] - session_best, 3)
                time_text = _fmt_total(best["time"]) if gap == 0 else _fmt_gap(gap)

        fallback = quali_fallback.get(code, {})
        rows.append(
            {
                "position": position,
                "classified_position": text(row.get("ClassifiedPosition")),
                "code": code,
                "number": text(row.get("DriverNumber"), str(number)),
                "full_name": text(row.get("FullName"), code),
                "team": text(row.get("TeamName"), "Unknown"),
                "team_color": hex_color(row.get("TeamColor")),
                "grid": integer(row.get("GridPosition")) or None,
                "status": status,
                "points": points,
                "laps": laps_done or integer(row.get("Laps")),
                "time_text": time_text,
                "gap": gap,
                "best_lap": best.get("time"),
                "best_lap_number": best.get("lap"),
                "fastest_lap": code == fastest_code,
                "q1": seconds(row.get("Q1")) or fallback.get("q1"),
                "q2": seconds(row.get("Q2")) or fallback.get("q2"),
                "q3": seconds(row.get("Q3")) or fallback.get("q3"),
            }
        )
    return rows


def _track_status_counts(session: Session) -> dict[str, int]:
    ts = getattr(session, "track_status", None)
    counts = {"safety_car": 0, "vsc": 0, "red_flag": 0, "yellow": 0}
    if ts is None or ts.empty:
        return counts
    statuses = ts["Status"].astype(str).tolist()
    prev = None
    for s in statuses:
        if s != prev:
            if s == "4":
                counts["safety_car"] += 1
            elif s == "6":
                counts["vsc"] += 1
            elif s == "5":
                counts["red_flag"] += 1
            elif s == "2":
                counts["yellow"] += 1
        prev = s
    return counts


def _weather_summary(session: Session) -> dict[str, Any] | None:
    w = getattr(session, "weather_data", None)
    if w is None or w.empty:
        return None
    return {
        "air_temp": num(w["AirTemp"].mean(), 1),
        "track_temp": num(w["TrackTemp"].mean(), 1),
        "track_temp_max": num(w["TrackTemp"].max(), 1),
        "humidity": num(w["Humidity"].mean(), 0),
        "wind_speed": num(w["WindSpeed"].mean(), 1),
        "rainfall": bool(w["Rainfall"].astype(bool).any()),
    }


def _pit_stop_count(session: Session) -> int:
    laps = session.laps
    return int(laps["PitInTime"].notna().sum()) if "PitInTime" in laps else 0


def _position_changes(session: Session) -> int:
    laps = session.laps[["Driver", "LapNumber", "Position"]].dropna()
    if laps.empty:
        return 0
    total = 0
    for _, group in laps.groupby("Driver"):
        pos = group.sort_values("LapNumber")["Position"].to_numpy()
        if len(pos) > 1:
            total += int(np.abs(np.diff(pos)).sum())
    return total // 2


def summary(ref: SessionRef, session: Session) -> dict[str, Any]:
    event = get_event(ref.season, ref.round)
    rows = classification(ref, session)
    lookup = common.driver_lookup(session)

    fastest = next((r for r in rows if r["fastest_lap"]), None)
    winner = rows[0] if rows else None
    retirements = (
        [r["code"] for r in rows if is_retirement(r["status"])] if ref.kind == "race" else []
    )

    laps = session.laps
    timed = laps[laps["LapTime"].notna()]
    total_distance_laps = int(len(laps))

    highlights = {
        "winner": winner["code"] if winner else None,
        "winner_team": winner["team"] if winner else None,
        "podium": [r["code"] for r in rows[:3]],
        "fastest_lap": (
            {
                "driver": fastest["code"],
                "team": fastest["team"],
                "time": fastest["best_lap"],
                "lap": fastest["best_lap_number"],
            }
            if fastest
            else None
        ),
        "total_laps": common.total_laps(session),
        "laps_recorded": total_distance_laps,
        "timed_laps": int(len(timed)),
        "pit_stops": _pit_stop_count(session),
        "position_changes": _position_changes(session) if ref.kind == "race" else None,
        "retirements": retirements,
        **_track_status_counts(session),
    }

    return {
        "season": ref.season,
        "round": ref.round,
        "session": {
            "code": ref.code,
            "name": ref.name,
            "kind": ref.kind,
        },
        "event": event,
        "drivers": list(lookup.values()),
        "results": rows,
        "highlights": highlights,
        "weather": _weather_summary(session),
    }
