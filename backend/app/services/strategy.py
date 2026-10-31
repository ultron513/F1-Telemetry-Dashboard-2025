"""Tyre strategy, pit stops, race trace and degradation modelling."""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Session

from app.core.serialize import boolean, integer, is_missing, num, seconds, text
from app.services import common

# Rough fuel-burn lap-time effect used to fuel-correct degradation slopes.
FUEL_EFFECT_PER_LAP = 0.035


def _finishing_order(session: Session) -> list[str]:
    lookup = common.drivers(session)
    ordered = sorted(lookup, key=lambda d: d["position"] if d["position"] else 99)
    return [d["code"] for d in ordered]


def _fit(x: np.ndarray, y: np.ndarray) -> tuple[float | None, float | None, float | None]:
    if len(x) < 4 or np.ptp(x) == 0:
        return None, None, None
    slope, intercept = np.polyfit(x, y, 1)
    pred = slope * x + intercept
    ss_res = float(((y - pred) ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return float(slope), float(intercept), r2


def stints(session: Session) -> list[dict[str, Any]]:
    lookup = common.driver_lookup(session)
    out = []
    for code in _finishing_order(session):
        laps = session.laps.pick_drivers(code).sort_values("LapNumber")
        if laps.empty:
            continue
        driver_stints = []
        for stint_no, group in laps.groupby("Stint"):
            clean = common.clean_laps(group)
            times = common.lap_seconds(clean)
            life = clean["TyreLife"].to_numpy(dtype=float) if not clean.empty else np.array([])
            slope, _, r2 = _fit(life, times) if len(times) else (None, None, None)
            driver_stints.append(
                {
                    "stint": integer(stint_no),
                    "compound": text(group["Compound"].iloc[0], "UNKNOWN"),
                    "start_lap": integer(group["LapNumber"].min()),
                    "end_lap": integer(group["LapNumber"].max()),
                    "laps": int(len(group)),
                    "start_age": integer(group["TyreLife"].iloc[0]),
                    "fresh": boolean(group["FreshTyre"].iloc[0]),
                    "average": num(times.mean()) if len(times) else None,
                    "degradation": num(slope, 4),
                    "fuel_corrected_degradation": num(slope + FUEL_EFFECT_PER_LAP, 4)
                    if slope is not None
                    else None,
                    "fit_r2": num(r2, 3),
                }
            )
        out.append(
            {
                "code": code,
                "team": lookup.get(code, {}).get("team"),
                "team_color": lookup.get(code, {}).get("team_color"),
                "stints": driver_stints,
            }
        )
    return out


def pit_stops(session: Session) -> list[dict[str, Any]]:
    out = []
    lookup = common.driver_lookup(session)
    for code in lookup:
        laps = session.laps.pick_drivers(code).sort_values("LapNumber").reset_index(drop=True)
        stop_no = 0
        for i, lap in laps.iterrows():
            if is_missing(lap.get("PitInTime")):
                continue
            if i + 1 >= len(laps):
                continue  # retired into the pits
            nxt = laps.iloc[i + 1]
            if is_missing(nxt.get("PitOutTime")):
                continue
            stop_no += 1
            lane = seconds(nxt["PitOutTime"] - lap["PitInTime"], 2)
            statuses = set(common.status_codes(lap.get("TrackStatus"))) | set(
                common.status_codes(nxt.get("TrackStatus"))
            )
            under = None
            if "4" in statuses:
                under = "SC"
            elif statuses & {"6", "7"}:
                under = "VSC"
            elif "5" in statuses:
                under = "RED"
            out.append(
                {
                    "code": code,
                    "team": lookup[code]["team"],
                    "team_color": lookup[code]["team_color"],
                    "stop": stop_no,
                    "lap": integer(lap["LapNumber"]),
                    "pit_lane_time": lane,
                    "from_compound": text(lap.get("Compound")),
                    "to_compound": text(nxt.get("Compound")),
                    "under": under,
                }
            )
    out.sort(key=lambda s: (s["lap"] or 0, s["pit_lane_time"] or 99))
    return out


def _pit_loss(session: Session, stops: list[dict[str, Any]]) -> float | None:
    """Data-derived pit loss: (in-lap + out-lap) − 2 × driver's median clean lap."""
    losses = []
    for s in stops:
        if s["under"]:
            continue
        laps = session.laps.pick_drivers(s["code"]).set_index("LapNumber")
        clean = common.lap_seconds(common.clean_laps(session.laps.pick_drivers(s["code"])))
        if len(clean) < 5 or s["lap"] not in laps.index or (s["lap"] + 1) not in laps.index:
            continue
        in_lap = seconds(laps.loc[s["lap"], "LapTime"])
        out_lap = seconds(laps.loc[s["lap"] + 1, "LapTime"])
        if in_lap is None or out_lap is None:
            continue
        losses.append(in_lap + out_lap - 2 * float(np.median(clean)))
    if not losses:
        return None
    return num(float(np.median(losses)), 2)


def strategy(session: Session) -> dict[str, Any]:
    st = stints(session)
    stops = pit_stops(session)
    lanes = [s["pit_lane_time"] for s in stops if s["pit_lane_time"] and not s["under"]]
    compounds: dict[str, list[float]] = {}
    for d in st:
        for s in d["stints"]:
            if s["fuel_corrected_degradation"] is not None and (s["fit_r2"] or 0) > 0.1:
                compounds.setdefault(s["compound"], []).append(s["fuel_corrected_degradation"])
    compound_deg = {c: num(float(np.median(v)), 4) for c, v in compounds.items() if v}
    pit_loss = _pit_loss(session, stops)
    return {
        "total_laps": common.total_laps(session),
        "stints": st,
        "pit_stops": stops,
        "pit_loss": pit_loss,
        "median_pit_lane": num(float(np.median(lanes)), 2) if lanes else None,
        "fastest_pit_lane": min(stops, key=lambda s: s["pit_lane_time"] or 999) if stops else None,
        "compound_degradation": compound_deg,
    }


def race_trace(session: Session) -> dict[str, Any]:
    """Position and gap-to-leader for every driver on every lap."""
    laps = session.laps[["Driver", "LapNumber", "Position", "Time"]].copy()
    laps = laps.dropna(subset=["LapNumber"])
    laps["t"] = laps["Time"].dt.total_seconds()
    leader_t = laps.groupby("LapNumber")["t"].min()
    lookup = common.driver_lookup(session)
    series = []
    for code in _finishing_order(session):
        group = laps[laps["Driver"] == code].sort_values("LapNumber")
        if group.empty:
            continue
        points = []
        for _, r in group.iterrows():
            lap_no = int(r["LapNumber"])
            gap = None
            if not is_missing(r["t"]) and lap_no in leader_t.index:
                gap = round(float(r["t"] - leader_t.loc[lap_no]), 3)
            points.append({"lap": lap_no, "position": integer(r["Position"]), "gap": gap})
        series.append(
            {
                "code": code,
                "team": lookup[code]["team"],
                "team_color": lookup[code]["team_color"],
                "points": points,
            }
        )
    status_by_lap = _lap_status(session)
    return {
        "total_laps": common.total_laps(session),
        "drivers": series,
        "lap_status": status_by_lap,
    }


def _lap_status(session: Session) -> list[dict[str, Any]]:
    """Worst track status seen on each lap (leader's view)."""
    out = []
    laps = session.laps.dropna(subset=["LapNumber"])
    priority = ["5", "4", "6", "7", "2"]
    for lap_no, group in laps.groupby("LapNumber"):
        codes = set()
        for v in group["TrackStatus"]:
            codes |= set(common.status_codes(v))
        status = next((p for p in priority if p in codes), "1")
        out.append({"lap": int(lap_no), "status": status})
    return out


def degradation(session: Session, code: str) -> dict[str, Any]:
    info = common.require_driver(session, code)
    laps = common.driver_laps(session, code)
    out_stints = []
    for stint_no, group in laps.groupby("Stint"):
        clean = common.clean_laps(group)
        times = common.lap_seconds(clean)
        life = clean["TyreLife"].to_numpy(dtype=float) if not clean.empty else np.array([])
        slope, intercept, r2 = _fit(life, times) if len(times) else (None, None, None)
        corrected_times = (
            times
            + FUEL_EFFECT_PER_LAP
            * (clean["LapNumber"].to_numpy(dtype=float) - float(laps["LapNumber"].min()))
            if len(times)
            else times
        )
        c_slope, c_intercept, c_r2 = (
            _fit(life, corrected_times) if len(times) else (None, None, None)
        )
        out_stints.append(
            {
                "stint": integer(stint_no),
                "compound": text(group["Compound"].iloc[0], "UNKNOWN"),
                "start_lap": integer(group["LapNumber"].min()),
                "end_lap": integer(group["LapNumber"].max()),
                "laps": [
                    {
                        "lap": integer(r["LapNumber"]),
                        "tyre_life": integer(r["TyreLife"]),
                        "time": seconds(r["LapTime"]),
                        "fuel_corrected": num(ct),
                    }
                    for (_, r), ct in zip(clean.iterrows(), corrected_times)
                ],
                "slope": num(slope, 4),
                "intercept": num(intercept, 3),
                "r2": num(r2, 3),
                "fuel_corrected_slope": num(c_slope, 4),
                "fuel_corrected_intercept": num(c_intercept, 3),
                "fuel_corrected_r2": num(c_r2, 3),
            }
        )
    return {"driver": info, "fuel_effect_per_lap": FUEL_EFFECT_PER_LAP, "stints": out_stints}


def recommendation(session: Session, code: str) -> dict[str, Any]:
    """Pit-wall style call for the driver's stints based on measured data.

    Uses the classic stint-length balance: the optimal stint length that
    trades linear tyre degradation ``k`` (s/lap) against pit loss ``P`` is
    ``n* = sqrt(2·P / k)`` — beyond that, staying out costs more per lap
    than stopping again.
    """
    info = common.require_driver(session, code)
    data = strategy(session)
    deg = degradation(session, code)
    pit_loss = data["pit_loss"] or data["median_pit_lane"] or 22.0
    total = data["total_laps"] or 60
    calls = []
    for s in deg["stints"]:
        k = s["fuel_corrected_slope"]
        lap_count = (s["end_lap"] or 0) - (s["start_lap"] or 0) + 1
        optimal = None
        if k is None:
            verdict = "insufficient-data"
        elif k <= 0.005:
            verdict = "no-degradation"
        else:
            optimal = float(np.sqrt(2 * pit_loss / k))
            if optimal >= total:
                verdict = "deg-not-limiting"
                optimal = float(total)
            elif lap_count > optimal * 1.15:
                verdict = "overextended"
            elif lap_count < optimal * 0.6:
                verdict = "early"
            else:
                verdict = "on-target"
        calls.append(
            {
                "stint": s["stint"],
                "compound": s["compound"],
                "laps": lap_count,
                "degradation": k,
                "optimal_length": num(optimal, 1),
                "verdict": verdict,
            }
        )
    worst = max(
        (c for c in calls if c["degradation"] is not None),
        key=lambda c: c["degradation"],
        default=None,
    )
    if worst is None:
        risk = "unknown"
    elif worst["degradation"] > 0.12:
        risk = "high"
    elif worst["degradation"] > 0.06:
        risk = "medium"
    else:
        risk = "low"
    return {
        "driver": info,
        "pit_loss": pit_loss,
        "pit_loss_source": "measured" if data["pit_loss"] else "estimated",
        "risk": risk,
        "stints": calls,
    }
