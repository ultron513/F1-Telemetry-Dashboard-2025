"""Lap tables, timing-screen colours and race-pace distributions."""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Session

from app.core.serialize import boolean, integer, is_missing, num, seconds, text
from app.services import common


def _session_bests(session: Session) -> dict[str, float | None]:
    laps = session.laps
    if "Deleted" in laps.columns:
        laps = laps[laps["Deleted"] != True]  # noqa: E712
    return {
        "lap": seconds(laps["LapTime"].min()),
        "s1": seconds(laps["Sector1Time"].min()),
        "s2": seconds(laps["Sector2Time"].min()),
        "s3": seconds(laps["Sector3Time"].min()),
    }


def _grade(value: float | None, personal: float | None, overall: float | None) -> str | None:
    """F1 timing colours: purple = session best, green = personal best, yellow = slower."""
    if value is None:
        return None
    if overall is not None and abs(value - overall) < 1e-6:
        return "purple"
    if personal is not None and abs(value - personal) < 1e-6:
        return "green"
    return "yellow"


def driver_lap_table(session: Session, code: str) -> dict[str, Any]:
    info = common.require_driver(session, code)
    laps = common.driver_laps(session, code)
    valid = laps[laps["Deleted"] != True] if "Deleted" in laps.columns else laps  # noqa: E712

    overall = _session_bests(session)
    personal = {
        "lap": seconds(valid["LapTime"].min()),
        "s1": seconds(valid["Sector1Time"].min()),
        "s2": seconds(valid["Sector2Time"].min()),
        "s3": seconds(valid["Sector3Time"].min()),
    }

    rows: list[dict[str, Any]] = []
    for _, lap in laps.iterrows():
        lt = seconds(lap["LapTime"])
        s1 = seconds(lap["Sector1Time"])
        s2 = seconds(lap["Sector2Time"])
        s3 = seconds(lap["Sector3Time"])
        deleted = boolean(lap.get("Deleted"))
        rows.append(
            {
                "lap": integer(lap["LapNumber"]),
                "time": lt,
                "s1": s1,
                "s2": s2,
                "s3": s3,
                "grade": None if deleted else _grade(lt, personal["lap"], overall["lap"]),
                "s1_grade": _grade(s1, personal["s1"], overall["s1"]),
                "s2_grade": _grade(s2, personal["s2"], overall["s2"]),
                "s3_grade": _grade(s3, personal["s3"], overall["s3"]),
                "compound": text(lap.get("Compound")),
                "tyre_life": integer(lap.get("TyreLife")),
                "fresh_tyre": boolean(lap.get("FreshTyre")),
                "stint": integer(lap.get("Stint")),
                "position": integer(lap.get("Position")),
                "pit_in": not is_missing(lap.get("PitInTime")),
                "pit_out": not is_missing(lap.get("PitOutTime")),
                "track_status": common.status_codes(lap.get("TrackStatus")),
                "deleted": deleted,
                "deleted_reason": text(lap.get("DeletedReason")),
                "speed_i1": num(lap.get("SpeedI1"), 1),
                "speed_i2": num(lap.get("SpeedI2"), 1),
                "speed_fl": num(lap.get("SpeedFL"), 1),
                "speed_st": num(lap.get("SpeedST"), 1),
                "personal_best": boolean(lap.get("IsPersonalBest")),
            }
        )

    clean = common.clean_laps(laps)
    clean_times = common.lap_seconds(clean)
    theoretical = None
    if all(personal[k] is not None for k in ("s1", "s2", "s3")):
        theoretical = round(personal["s1"] + personal["s2"] + personal["s3"], 3)

    stints = []
    for stint_no, group in laps.groupby("Stint"):
        g_clean = common.clean_laps(group)
        times = common.lap_seconds(g_clean)
        stints.append(
            {
                "stint": integer(stint_no),
                "compound": text(group["Compound"].iloc[0]),
                "start_lap": integer(group["LapNumber"].min()),
                "end_lap": integer(group["LapNumber"].max()),
                "laps": int(len(group)),
                "average": num(times.mean()) if len(times) else None,
                "best": num(times.min()) if len(times) else None,
            }
        )

    return {
        "driver": info,
        "laps": rows,
        "session_best": overall,
        "personal_best": personal,
        "stats": {
            "best_lap": personal["lap"],
            "theoretical_best": theoretical,
            "average_clean": num(clean_times.mean()) if len(clean_times) else None,
            "median_clean": num(np.median(clean_times)) if len(clean_times) else None,
            "std_clean": num(clean_times.std()) if len(clean_times) > 1 else None,
            "clean_laps": int(len(clean_times)),
            "total_laps": int(len(laps)),
            "pit_stops": int(laps["PitInTime"].notna().sum()),
        },
        "stints": stints,
    }


def field_pace(session: Session) -> dict[str, Any]:
    """Clean-lap distribution for every driver (box plot / violin / scatter)."""
    lookup = common.driver_lookup(session)
    entries = []
    for code, info in lookup.items():
        laps = session.laps.pick_drivers(code)
        clean = common.clean_laps(laps)
        if clean.empty:
            continue
        times = common.lap_seconds(clean)
        q1, med, q3 = np.percentile(times, [25, 50, 75])
        entries.append(
            {
                "code": code,
                "team": info["team"],
                "team_color": info["team_color"],
                "laps": [
                    {
                        "lap": integer(r["LapNumber"]),
                        "time": seconds(r["LapTime"]),
                        "compound": text(r.get("Compound")),
                        "tyre_life": integer(r.get("TyreLife")),
                    }
                    for _, r in clean.iterrows()
                ],
                "min": num(times.min()),
                "q1": num(q1),
                "median": num(med),
                "q3": num(q3),
                "max": num(times.max()),
                "mean": num(times.mean()),
                "std": num(times.std()) if len(times) > 1 else None,
            }
        )
    entries.sort(key=lambda e: e["median"] if e["median"] is not None else 1e9)
    best_median = entries[0]["median"] if entries else None
    for e in entries:
        e["gap_to_best"] = num(e["median"] - best_median) if best_median is not None else None
    return {"drivers": entries}
