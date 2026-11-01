"""Driver style, ideal laps, car characteristics and tyre management.

Everything here is derived from FastF1 timing and ~4 Hz car telemetry,
resampled onto a 5 m distance grid (see :mod:`app.services.telemetry`).
Corner positions come from the official circuit info (or detected speed
minima), so the same corner is compared across drivers.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Lap, Session

from app.core.errors import NotFoundError
from app.core.serialize import integer, num, seconds
from app.services import common, strategy as strategy_svc
from app.services.circuit import lap_trace
from app.services.telemetry import _anchor_time, _grid, _resample

SLOW, FAST = 125.0, 210.0  # km/h apex speed bands
BRAKE_WINDOW = (320.0, 40.0)  # metres before / after the apex searched for the brake point
THROTTLE_FULL = 95.0


# --------------------------------------------------------------------------
# Lap preparation
# --------------------------------------------------------------------------


def _lap_data(lap: Lap) -> dict[str, np.ndarray] | None:
    try:
        trace = lap_trace(lap)
    except Exception:
        return None
    if len(trace) < 50:
        return None
    grid = _grid(float(trace["distance"].iloc[-1]))
    data = _resample(trace, grid)
    _anchor_time(data, seconds(lap.get("LapTime")))
    return data


def _fastest(session: Session, code: str) -> Lap:
    return common.resolve_lap(session, code, "fastest")


def corner_class(speed: float) -> str:
    return "slow" if speed < SLOW else "fast" if speed > FAST else "medium"


# --------------------------------------------------------------------------
# Corner-by-corner style
# --------------------------------------------------------------------------


def corner_metrics(
    data: dict[str, np.ndarray], corners: list[dict[str, Any]], track_length: float
) -> list[dict[str, Any]]:
    """Braking point, entry / apex / exit speed and throttle pick-up per corner."""
    dist = data["distance"]
    speed = data["speed"]
    brake = data["brake"] > 0.5
    throttle = data["throttle"]
    scale = dist[-1] / track_length if track_length else 1.0
    out = []
    marks = sorted(float(c["distance"]) * scale for c in corners if c.get("distance") is not None)
    for c in (c for c in corners if c.get("distance") is not None):
        d = float(c["distance"]) * scale
        lo, hi = np.searchsorted(dist, [d - 90, d + 60])
        if hi - lo < 3:
            continue
        apex = lo + int(np.argmin(speed[lo:hi]))
        # Search back for the start of this corner's braking, but not past the previous corner.
        prev_mark = max((m for m in marks if m < d - 60), default=0.0)
        b_lo = int(np.searchsorted(dist, max(prev_mark, dist[apex] - BRAKE_WINDOW[0])))
        brake_idx = None
        k = apex
        while k > b_lo and not brake[k]:
            k -= 1
        if brake[k]:
            while k > b_lo and brake[k - 1]:
                k -= 1
            brake_idx = k
        lift_idx = None
        if brake_idx is None:
            # Lift-and-coast corners: where throttle first drops below 95 %.
            k = apex
            while k > b_lo and throttle[k] < THROTTLE_FULL:
                k -= 1
            lift_idx = k if k < apex else None
        start_idx = brake_idx if brake_idx is not None else lift_idx
        next_mark = min((m for m in marks if m > d + 60), default=dist[-1])
        t_hi = int(np.searchsorted(dist, min(next_mark, dist[apex] + 400)))
        pick = next(
            (j for j in range(apex, max(apex + 1, t_hi)) if throttle[j] >= THROTTLE_FULL), None
        )
        exit_idx = min(len(dist) - 1, int(np.searchsorted(dist, dist[apex] + 150)))
        apex_speed = float(speed[apex])
        out.append(
            {
                "number": integer(c["number"]),
                "letter": c.get("letter", "") or "",
                "class": corner_class(apex_speed),
                "apex_distance": num(dist[apex], 1),
                "brake_point": num(dist[apex] - dist[start_idx], 1)
                if start_idx is not None
                else None,
                "braked": brake_idx is not None,
                "entry_speed": num(speed[start_idx], 1) if start_idx is not None else None,
                "apex_speed": num(apex_speed, 1),
                "exit_speed": num(speed[exit_idx], 1),
                "gear": int(data["gear"][apex]),
                "throttle_pickup": num(dist[pick] - dist[apex], 1) if pick is not None else None,
                "time": num(
                    float(
                        np.interp(dist[apex] + 100, dist, data["time"])
                        - np.interp(dist[apex] - 150, dist, data["time"])
                    ),
                    3,
                ),
            }
        )
    return out


def _fingerprint(
    data: dict[str, np.ndarray], corners: list[dict[str, Any]]
) -> dict[str, float | None]:
    """Lap-level style metrics (raw values)."""
    t = data["time"]
    dt = np.diff(t, prepend=t[0])
    total = dt.sum() or 1.0
    coasting = (data["throttle"] < 5) & (data["brake"] < 0.5)
    by_class: dict[str, list[float]] = {"slow": [], "medium": [], "fast": []}
    for c in corners:
        if c["apex_speed"] is not None:
            by_class[c["class"]].append(c["apex_speed"])
    braking = [c["brake_point"] for c in corners if c["braked"] and c["brake_point"] is not None]
    pickup = [c["throttle_pickup"] for c in corners if c["throttle_pickup"] is not None]
    return {
        "top_speed": float(data["speed"].max()),
        "full_throttle": float(dt[data["throttle"] >= THROTTLE_FULL].sum() / total * 100),
        "braking_share": float(dt[data["brake"] > 0.5].sum() / total * 100),
        "coasting": float(dt[coasting].sum() / total * 100),
        "brake_point": float(np.mean(braking)) if braking else None,
        "throttle_pickup": float(np.mean(pickup)) if pickup else None,
        "slow_corners": float(np.mean(by_class["slow"])) if by_class["slow"] else None,
        "medium_corners": float(np.mean(by_class["medium"])) if by_class["medium"] else None,
        "fast_corners": float(np.mean(by_class["fast"])) if by_class["fast"] else None,
        "gear_changes": float(np.count_nonzero(np.diff(data["gear"].astype(int)))),
    }


# Metric → (label, higher_is_better_for_score, description)
STYLE_AXES: dict[str, tuple[str, bool, str]] = {
    "brake_point": ("Late braking", False, "Shorter braking distance before the apex"),
    "slow_corners": ("Slow-corner speed", True, "Average apex speed below 125 km/h"),
    "medium_corners": ("Medium-corner speed", True, "Average apex speed 125–210 km/h"),
    "fast_corners": ("Fast-corner speed", True, "Average apex speed above 210 km/h"),
    "throttle_pickup": ("Early throttle", False, "Distance from apex to full throttle"),
    "full_throttle": ("Full throttle", True, "Share of the lap flat out"),
    "coasting": ("No coasting", False, "Share of the lap off both pedals"),
    "top_speed": ("Top speed", True, "Maximum speed on the lap"),
}


def _percentile_scores(
    values: dict[str, dict[str, float | None]],
) -> dict[str, dict[str, float | None]]:
    """0–100 score per axis relative to the field (100 = best on that axis)."""
    out: dict[str, dict[str, float | None]] = {code: {} for code in values}
    for axis, (_, higher, _) in STYLE_AXES.items():
        pairs = [(c, v[axis]) for c, v in values.items() if v.get(axis) is not None]
        if len(pairs) < 2:
            for c in values:
                out[c][axis] = None
            continue
        vals = np.array([p[1] for p in pairs], dtype=float)
        for code, v in pairs:
            better = (vals < v).sum() if higher else (vals > v).sum()
            equal = (vals == v).sum() - 1
            out[code][axis] = round(float((better + 0.5 * equal) / (len(vals) - 1) * 100), 1)
        for c in values:
            out[c].setdefault(axis, None)
    return out


def driving_style(
    session: Session, codes: list[str], corners: list[dict[str, Any]], track_length: float
) -> dict[str, Any]:
    """Fingerprints for the whole field on their fastest laps, detail for ``codes``."""
    field: dict[str, dict[str, float | None]] = {}
    detail: dict[str, list[dict[str, Any]]] = {}
    laps: dict[str, dict[str, Any]] = {}
    for d in common.drivers(session):
        code = d["code"]
        try:
            lap = _fastest(session, code)
        except NotFoundError:
            continue
        data = _lap_data(lap)
        if data is None:
            continue
        metrics = corner_metrics(data, corners, track_length)
        field[code] = _fingerprint(data, metrics)
        if code in codes:
            detail[code] = metrics
            laps[code] = {"lap": integer(lap.get("LapNumber")), "time": seconds(lap.get("LapTime"))}
    if not field:
        raise NotFoundError("No telemetry is available for this session.")
    scores = _percentile_scores(field)
    lookup = common.driver_lookup(session)
    return {
        "axes": [{"key": k, "label": v[0], "description": v[2]} for k, v in STYLE_AXES.items()],
        "drivers": [
            {
                **{k: lookup[c][k] for k in ("code", "team", "team_color")},
                "lap": laps.get(c),
                "scores": scores[c],
                "raw": {k: num(v, 2) for k, v in field[c].items()},
                "corners": detail.get(c, []),
            }
            for c in codes
            if c in field
        ],
        "field_size": len(field),
    }


# --------------------------------------------------------------------------
# Ideal lap
# --------------------------------------------------------------------------


def _calibrate(
    data: dict[str, np.ndarray], lap: Lap, sector_marks: list[float], ref_length: float
) -> np.ndarray:
    """Telemetry clock, remapped so each official sector takes its official time.

    Timing-loop sector times are accurate to a millisecond; the 4 Hz car data
    clock drifts. Anchoring both removes most of the noise that would
    otherwise make a stitched "ideal" lap look unrealistically fast.
    """
    t = data["time"]
    d = data["distance"]
    s = [seconds(lap.get(f"Sector{i}Time")) for i in (1, 2, 3)]
    if len(sector_marks) != 2 or any(v is None for v in s):
        return t
    scale = d[-1] / ref_length if ref_length else 1.0
    marks = [0.0, sector_marks[0] * scale, sector_marks[1] * scale, float(d[-1])]
    raw = np.interp(marks, d, t)
    official = np.array([0.0, s[0], s[0] + s[1], s[0] + s[1] + s[2]])
    if np.any(np.diff(raw) <= 0):
        return t
    return np.interp(t, raw, official)


def ideal_lap(
    session: Session,
    code: str,
    sector_marks: list[float] | None = None,
    track_length: float = 0.0,
    minisectors: int = 25,
    max_laps: int = 12,
) -> dict[str, Any]:
    """Best mini-sector times across the driver's quickest laps, stitched together."""
    info = common.require_driver(session, code)
    laps = common.driver_laps(session, code)
    laps = laps[laps["LapTime"].notna()]
    if "Deleted" in laps.columns:
        laps = laps[laps["Deleted"] != True]  # noqa: E712
    laps = laps[laps["PitInTime"].isna() & laps["PitOutTime"].isna()]
    if laps.empty:
        raise NotFoundError(f"{code} has no valid timed laps in this session.")
    # Only genuinely quick laps: within 1.5 % of the driver's best.
    laps = laps[laps["LapTime"] <= laps["LapTime"].min() * 1.015]
    laps = laps.sort_values("LapTime").head(max_laps)

    rows = []
    edges = None
    ref_length = 0.0
    for _, lap in laps.iterrows():
        data = _lap_data(lap)
        if data is None:
            continue
        length = data["distance"][-1]
        if edges is None:
            ref_length = length
            edges = np.linspace(0, length, minisectors + 1)
        clock = _calibrate(data, lap, sector_marks or [], track_length or ref_length)
        # Normalise each lap to the reference length so mini-sectors line up.
        d = data["distance"] * (ref_length / length)
        t = np.interp(edges, d, clock)
        rows.append((int(lap["LapNumber"]), float(lap["LapTime"].total_seconds()), np.diff(t)))
    if not rows or edges is None:
        raise NotFoundError(f"No telemetry for {code}'s laps.")

    matrix = np.vstack([r[2] for r in rows])
    best_idx = matrix.argmin(axis=0)
    best = matrix.min(axis=0)
    fastest_no, fastest_time, fastest_split = min(rows, key=lambda r: r[1])

    # The 4 Hz telemetry is too coarse for raw mini-sector minima to be
    # trusted (noise always favours "faster"), so the total comes from the
    # official timing loops: the best time in each sector across all laps.
    # Within each sector the telemetry only decides *where* the time is.
    all_laps = common.driver_laps(session, code)
    sector_best = [seconds(all_laps[f"Sector{i}Time"].min()) for i in (1, 2, 3)]
    theoretical = sum(sector_best) if all(s is not None for s in sector_best) else None
    mid = (edges[:-1] + edges[1:]) / 2
    marks = [m * (ref_length / (track_length or ref_length)) for m in (sector_marks or [])]
    sector_of = (
        np.searchsorted(np.array(marks), mid) if len(marks) == 2 else np.zeros(len(mid), int)
    )
    if theoretical is not None and len(marks) == 2:
        for k in range(3):
            mask = sector_of == k
            if mask.any() and best[mask].sum() > 0:
                best[mask] *= sector_best[k] / best[mask].sum()
        ideal = float(theoretical)
    else:
        ideal = float(best.sum())

    return {
        "driver": info,
        "laps_used": [r[0] for r in rows],
        "fastest_lap": {"lap": fastest_no, "time": num(fastest_time)},
        "ideal_time": num(ideal),
        "gain": num(fastest_time - ideal),
        "sector_theoretical": num(theoretical),
        "minisectors": [
            {
                "index": i,
                "start": num(edges[i], 1),
                "end": num(edges[i + 1], 1),
                "best": num(best[i]),
                "best_lap": rows[best_idx[i]][0],
                "fastest_lap_time": num(fastest_split[i]),
                "sector": int(sector_of[i]) + 1,
                "loss": num(fastest_split[i] - best[i]),
            }
            for i in range(minisectors)
        ],
    }


def field_ideal(session: Session) -> list[dict[str, Any]]:
    """Fastest lap vs theoretical best (official sectors) for every driver."""
    out = []
    for d in common.drivers(session):
        laps = session.laps.pick_drivers(d["code"])
        laps = laps[laps["LapTime"].notna()]
        if laps.empty:
            continue
        best = seconds(laps["LapTime"].min())
        s = [seconds(laps[f"Sector{i}Time"].min()) for i in (1, 2, 3)]
        theo = sum(s) if all(v is not None for v in s) else None
        out.append(
            {
                "code": d["code"],
                "team": d["team"],
                "team_color": d["team_color"],
                "best": best,
                "theoretical": num(theo),
                "gain": num(best - theo) if best is not None and theo is not None else None,
            }
        )
    out.sort(key=lambda r: r["theoretical"] or 1e9)
    return out


# --------------------------------------------------------------------------
# Car characteristics
# --------------------------------------------------------------------------


def car_characteristics(
    session: Session, corners: list[dict[str, Any]], track_length: float
) -> dict[str, Any]:
    """Straight-line speed vs cornering speed per team, from each team's quickest lap."""
    laps = session.laps[session.laps["LapTime"].notna()]
    teams: dict[str, dict[str, Any]] = {}
    lookup = common.driver_lookup(session)
    for team, group in laps.groupby("Team"):
        fastest = group.sort_values("LapTime").iloc[0]
        data = _lap_data(fastest)
        if data is None:
            continue
        metrics = corner_metrics(data, corners, track_length)
        fp = _fingerprint(data, metrics)
        code = fastest["Driver"]
        trap = group["SpeedST"].dropna()
        teams[str(team)] = {
            "team": str(team),
            "team_color": lookup.get(code, {}).get("team_color"),
            "driver": code,
            "lap_time": seconds(fastest["LapTime"]),
            "speed_trap": num(trap.quantile(0.9) if len(trap) else None, 1),
            "top_speed": num(fp["top_speed"], 1),
            "slow_corners": num(fp["slow_corners"], 1),
            "medium_corners": num(fp["medium_corners"], 1),
            "fast_corners": num(fp["fast_corners"], 1),
            "full_throttle": num(fp["full_throttle"], 1),
        }
    if not teams:
        raise NotFoundError("No telemetry is available for this session.")
    rows = list(teams.values())

    def z(key: str) -> dict[str, float]:
        vals = np.array([r[key] for r in rows if r[key] is not None], dtype=float)
        if len(vals) < 2 or vals.std() == 0:
            return {r["team"]: 0.0 for r in rows}
        return {
            r["team"]: float((r[key] - vals.mean()) / vals.std()) if r[key] is not None else 0.0
            for r in rows
        }

    straight = z("speed_trap")
    corner_keys = [
        k for k in ("slow_corners", "medium_corners", "fast_corners") if any(r[k] for r in rows)
    ]
    cornering = {r["team"]: 0.0 for r in rows}
    for k in corner_keys:
        for team, v in z(k).items():
            cornering[team] += v / len(corner_keys)
    for r in rows:
        s, c = straight[r["team"]], cornering[r["team"]]
        r["straight_index"] = num(s, 2)
        r["corner_index"] = num(c, 2)
        # Positive = trimmed for straights (low drag); negative = high downforce.
        r["drag_bias"] = num(s - c, 2)
        r["profile"] = (
            "Low drag" if s - c > 0.75 else "High downforce" if s - c < -0.75 else "Balanced"
        )
    rows.sort(key=lambda r: r["lap_time"] or 1e9)
    return {"teams": rows}


# --------------------------------------------------------------------------
# Tyre management
# --------------------------------------------------------------------------


def tyre_management(session: Session) -> dict[str, Any]:
    """How gently each driver treated the tyres, against the field on the same compound."""
    st = strategy_svc.stints(session)
    by_compound: dict[str, list[float]] = {}
    for d in st:
        for s in d["stints"]:
            if s["fuel_corrected_degradation"] is not None and s["laps"] >= 8:
                by_compound.setdefault(s["compound"], []).append(s["fuel_corrected_degradation"])
    median = {c: float(np.median(v)) for c, v in by_compound.items() if len(v) >= 3}

    rows = []
    for d in st:
        rel, weights, consistency = [], [], []
        for s in d["stints"]:
            k = s["fuel_corrected_degradation"]
            if k is None or s["laps"] < 8 or s["compound"] not in median:
                continue
            rel.append(k - median[s["compound"]])
            weights.append(s["laps"])
        laps = common.clean_laps(session.laps.pick_drivers(d["code"]))
        for _, group in laps.groupby("Stint"):
            if len(group) < 6:
                continue
            t = common.lap_seconds(group)
            x = group["TyreLife"].to_numpy(dtype=float)
            if np.ptp(x) == 0:
                continue
            fit = np.polyval(np.polyfit(x, t, 1), x)
            consistency.append(float(np.std(t - fit)))
        if not rel:
            continue
        deg = float(np.average(rel, weights=weights))
        cons = float(np.mean(consistency)) if consistency else None
        rows.append(
            {
                "code": d["code"],
                "team": d["team"],
                "team_color": d["team_color"],
                "relative_degradation": num(deg, 4),
                "consistency": num(cons, 3),
                "stints": len(rel),
            }
        )
    if not rows:
        raise NotFoundError("Not enough long stints to rate tyre management.")
    degs = np.array([r["relative_degradation"] for r in rows], dtype=float)
    cons = np.array([r["consistency"] if r["consistency"] is not None else np.nan for r in rows])
    for r in rows:
        d_rank = float((degs > r["relative_degradation"]).mean())
        c_val = r["consistency"]
        c_rank = float((cons[~np.isnan(cons)] > c_val).mean()) if c_val is not None else 0.5
        r["score"] = round(100 * (0.7 * d_rank + 0.3 * c_rank), 1)
    rows.sort(key=lambda r: -r["score"])
    teams: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        teams.setdefault(r["team"], []).append(r)
    pairs = [
        {
            "team": t,
            "drivers": [m["code"] for m in members],
            "delta": num(members[0]["score"] - members[1]["score"], 1),
        }
        for t, members in teams.items()
        if len(members) == 2
    ]
    return {
        "compound_median": {c: num(v, 4) for c, v in median.items()},
        "drivers": rows,
        "teammates": pairs,
    }


def corner_compare(style: dict[str, Any]) -> list[dict[str, Any]]:
    """Corner-by-corner deltas between the first two drivers in a style payload."""
    if len(style["drivers"]) < 2:
        return []
    a, b = style["drivers"][0], style["drivers"][1]
    bmap = {(c["number"], c["letter"]): c for c in b["corners"]}
    out = []
    for c in a["corners"]:
        o = bmap.get((c["number"], c["letter"]))
        if not o:
            continue
        out.append(
            {
                "corner": f"{c['number']}{c['letter']}",
                "class": c["class"],
                "time_delta": num((c["time"] or 0) - (o["time"] or 0), 3)
                if c["time"] is not None and o["time"] is not None
                else None,
                "apex_delta": num((c["apex_speed"] or 0) - (o["apex_speed"] or 0), 1),
                "brake_delta": num((c["brake_point"] or 0) - (o["brake_point"] or 0), 1)
                if c["brake_point"] is not None and o["brake_point"] is not None
                else None,
            }
        )
    return out
