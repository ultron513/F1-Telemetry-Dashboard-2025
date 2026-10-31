"""Distance-resampled lap telemetry, head-to-head comparison and derived insights."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from fastf1.core import Lap, Session

from app.core.serialize import integer, num, seconds, text
from app.services import common
from app.services.circuit import lap_trace

STEP_METRES = 5.0
CONTINUOUS = ("speed", "throttle", "rpm", "time", "x", "y")
DISCRETE = ("brake", "gear", "drs")


def _resample(
    trace: pd.DataFrame, grid: np.ndarray, src_dist: np.ndarray | None = None
) -> dict[str, np.ndarray]:
    dist = trace["distance"].to_numpy() if src_dist is None else src_dist
    out: dict[str, np.ndarray] = {"distance": grid}
    for ch in CONTINUOUS:
        out[ch] = np.interp(grid, dist, trace[ch].to_numpy())
    idx = np.clip(np.searchsorted(dist, grid), 0, len(dist) - 1)
    for ch in DISCRETE:
        out[ch] = trace[ch].to_numpy()[idx]
    out["drs_open"] = (out["drs"] >= 10).astype(float)
    out["throttle"] = np.clip(out["throttle"], 0, 100)
    return out


def _grid(length: float) -> np.ndarray:
    n = max(2, int(round(length / STEP_METRES)) + 1)
    return np.linspace(0.0, length, n)


def _anchor_time(data: dict[str, np.ndarray], lap_time: float | None) -> None:
    """Stretch the sampled clock so the lap spans exactly the official lap time.

    Car data starts/stops a few samples inside the timing line, so raw
    elapsed time drifts by tens of milliseconds; anchoring keeps the
    cumulative delta consistent with the official lap times.
    """
    t = data["time"]
    if lap_time and t[-1] > t[0]:
        data["time"] = (t - t[0]) / (t[-1] - t[0]) * lap_time


def _columns(data: dict[str, np.ndarray]) -> dict[str, list]:
    return {
        "distance": np.round(data["distance"], 1).tolist(),
        "time": np.round(data["time"], 3).tolist(),
        "speed": np.round(data["speed"], 1).tolist(),
        "throttle": np.round(data["throttle"], 1).tolist(),
        "brake": data["brake"].astype(int).tolist(),
        "rpm": np.round(data["rpm"]).astype(int).tolist(),
        "gear": data["gear"].astype(int).tolist(),
        "drs": data["drs_open"].astype(int).tolist(),
        "x": np.round(data["x"], 1).tolist(),
        "y": np.round(data["y"], 1).tolist(),
    }


def _time_weighted_share(mask: np.ndarray, time: np.ndarray) -> float:
    dt = np.diff(time, prepend=time[0])
    total = dt.sum()
    return float(dt[mask].sum() / total * 100) if total > 0 else 0.0


def _braking_zones(data: dict[str, np.ndarray]) -> list[dict[str, Any]]:
    brake = data["brake"] > 0.5
    dist, speed = data["distance"], data["speed"]
    zones = []
    i = 0
    n = len(brake)
    while i < n:
        if brake[i]:
            j = i
            while j + 1 < n and brake[j + 1]:
                j += 1
            if dist[j] - dist[i] >= 15:
                entry = float(speed[i])
                window_end = min(n - 1, j + 12)
                k = i + int(np.argmin(speed[i : window_end + 1]))
                minimum = float(speed[k])
                t_span = max(1e-3, float(data["time"][k] - data["time"][i]))
                decel_g = (entry - minimum) / 3.6 / t_span / 9.81
                zones.append(
                    {
                        "start": round(float(dist[i]), 1),
                        "end": round(float(dist[j]), 1),
                        "entry_speed": round(entry, 1),
                        "min_speed": round(minimum, 1),
                        "speed_drop": round(entry - minimum, 1),
                        "decel_g": round(decel_g, 2),
                    }
                )
            i = j + 1
        else:
            i += 1
    return zones


def _corner_speeds(
    data: dict[str, np.ndarray], corners: list[dict[str, Any]], length: float
) -> list[dict[str, Any]]:
    out = []
    dist, speed, gear = data["distance"], data["speed"], data["gear"]
    for c in corners:
        d = c.get("distance")
        if d is None:
            continue
        d = float(d) * (dist[-1] / length if length else 1.0)
        lo, hi = np.searchsorted(dist, [d - 90, d + 60])
        if hi <= lo:
            continue
        k = lo + int(np.argmin(speed[lo:hi]))
        out.append(
            {
                "number": c["number"],
                "letter": c.get("letter", ""),
                "distance": round(float(dist[k]), 1),
                "min_speed": round(float(speed[k]), 1),
                "gear": int(gear[k]),
            }
        )
    return out


def _stats(data: dict[str, np.ndarray]) -> dict[str, Any]:
    time = data["time"]
    gear = data["gear"].astype(int)
    full = data["throttle"] >= 98
    braking = data["brake"] > 0.5
    coasting = (data["throttle"] < 5) & ~braking
    return {
        "max_speed": num(data["speed"].max(), 1),
        "min_speed": num(data["speed"].min(), 1),
        "avg_speed": num(
            (data["distance"][-1] - data["distance"][0]) / max(1e-3, time[-1] - time[0]) * 3.6,
            1,
        ),
        "max_rpm": integer(data["rpm"].max()),
        "avg_rpm": integer(data["rpm"].mean()),
        "full_throttle_pct": num(_time_weighted_share(full, time), 1),
        "braking_pct": num(_time_weighted_share(braking, time), 1),
        "coasting_pct": num(_time_weighted_share(coasting, time), 1),
        "drs_pct": num(_time_weighted_share(data["drs_open"] > 0, time), 1),
        "gear_changes": int(np.count_nonzero(np.diff(gear))),
        "top_gear": int(gear.max()),
        "distance": num(data["distance"][-1], 1),
    }


def _lap_meta(lap: Lap) -> dict[str, Any]:
    return {
        "lap": integer(lap.get("LapNumber")),
        "time": seconds(lap.get("LapTime")),
        "s1": seconds(lap.get("Sector1Time")),
        "s2": seconds(lap.get("Sector2Time")),
        "s3": seconds(lap.get("Sector3Time")),
        "compound": text(lap.get("Compound")),
        "tyre_life": integer(lap.get("TyreLife")),
        "position": integer(lap.get("Position")),
        "speed_trap": num(lap.get("SpeedST"), 1),
        "deleted": bool(lap.get("Deleted")) if not common.is_missing(lap.get("Deleted")) else False,
    }


def _sector_marks(meta: dict[str, Any], data: dict[str, np.ndarray]) -> list[float]:
    marks = []
    if meta["s1"] is not None:
        marks.append(round(float(np.interp(meta["s1"], data["time"], data["distance"])), 1))
        if meta["s2"] is not None:
            marks.append(
                round(float(np.interp(meta["s1"] + meta["s2"], data["time"], data["distance"])), 1)
            )
    return marks


def _insights(
    stats: dict[str, Any], zones: list[dict], corners: list[dict]
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if zones:
        heavy = max(zones, key=lambda z: z["speed_drop"])
        out.append(
            {
                "kind": "braking",
                "title": "Heaviest stop",
                "text": f"{heavy['entry_speed']:.0f} → {heavy['min_speed']:.0f} km/h at "
                f"{heavy['start']:.0f} m (≈{heavy['decel_g']:.1f} g).",
            }
        )
    if corners:
        slowest = min(corners, key=lambda c: c["min_speed"])
        fastest = max(corners, key=lambda c: c["min_speed"])
        out.append(
            {
                "kind": "corner",
                "title": "Slowest corner",
                "text": f"Turn {slowest['number']}{slowest['letter']} at {slowest['min_speed']:.0f} km/h in gear {slowest['gear']}.",
            }
        )
        out.append(
            {
                "kind": "corner",
                "title": "Fastest corner",
                "text": f"Turn {fastest['number']}{fastest['letter']} taken at {fastest['min_speed']:.0f} km/h.",
            }
        )
    if stats["full_throttle_pct"] is not None:
        out.append(
            {
                "kind": "power",
                "title": "Full throttle",
                "text": f"{stats['full_throttle_pct']:.0f}% of the lap flat out, top speed {stats['max_speed']:.0f} km/h.",
            }
        )
    if stats["drs_pct"]:
        out.append(
            {
                "kind": "drs",
                "title": "DRS",
                "text": f"Flap open for {stats['drs_pct']:.0f}% of the lap.",
            }
        )
    return out


def lap_telemetry(
    session: Session, code: str, lap_id: str | int | None, corners: list[dict], track_length: float
) -> dict[str, Any]:
    info = common.require_driver(session, code)
    lap = common.resolve_lap(session, code, lap_id)
    trace = lap_trace(lap)
    if len(trace) < 10:
        raise common.NotFoundError(f"No telemetry recorded for {code} lap {lap_id}.")
    length = float(trace["distance"].iloc[-1])
    grid = _grid(length)
    data = _resample(trace, grid)
    meta = _lap_meta(lap)
    _anchor_time(data, meta["time"])
    stats = _stats(data)
    zones = _braking_zones(data)
    corner_speeds = _corner_speeds(data, corners, track_length)
    return {
        "driver": info,
        "lap": meta,
        "sector_marks": _sector_marks(meta, data),
        "channels": _columns(data),
        "stats": stats,
        "braking_zones": zones,
        "corners": corner_speeds,
        "insights": _insights(stats, zones, corner_speeds),
    }


def compare(
    session: Session,
    code_a: str,
    lap_a: str | int | None,
    code_b: str,
    lap_b: str | int | None,
    minisectors: int = 25,
) -> dict[str, Any]:
    info_a = common.require_driver(session, code_a)
    info_b = common.require_driver(session, code_b)
    la = common.resolve_lap(session, code_a, lap_a)
    lb = common.resolve_lap(session, code_b, lap_b)
    ta, tb = lap_trace(la), lap_trace(lb)

    len_a = float(ta["distance"].iloc[-1])
    len_b = float(tb["distance"].iloc[-1])
    grid = _grid(len_a)
    da = _resample(ta, grid)
    # Map B onto A's distance axis via relative lap distance so both
    # traces line up even though recorded lap lengths differ slightly.
    db = _resample(tb, grid, src_dist=tb["distance"].to_numpy() * (len_a / len_b))
    _anchor_time(da, seconds(la.get("LapTime")))
    _anchor_time(db, seconds(lb.get("LapTime")))

    delta = db["time"] - da["time"]  # positive = B behind A

    edges = np.linspace(0, len_a, minisectors + 1)
    t_a = np.interp(edges, grid, da["time"])
    t_b = np.interp(edges, grid, db["time"])
    seg_a = np.diff(t_a)
    seg_b = np.diff(t_b)
    minis = []
    for i in range(minisectors):
        diff = float(seg_b[i] - seg_a[i])
        minis.append(
            {
                "index": i,
                "start": round(float(edges[i]), 1),
                "end": round(float(edges[i + 1]), 1),
                "time_a": round(float(seg_a[i]), 3),
                "time_b": round(float(seg_b[i]), 3),
                "winner": "a" if diff > 0.0005 else ("b" if diff < -0.0005 else "even"),
                "gain": round(abs(diff), 3),
            }
        )

    meta_a, meta_b = _lap_meta(la), _lap_meta(lb)
    sectors = []
    for key in ("s1", "s2", "s3"):
        a, b = meta_a[key], meta_b[key]
        sectors.append(
            {
                "sector": key.upper(),
                "a": a,
                "b": b,
                "delta": round(b - a, 3) if a is not None and b is not None else None,
            }
        )

    stats_a, stats_b = _stats(da), _stats(db)
    return {
        "a": {"driver": info_a, "lap": meta_a, "stats": stats_a},
        "b": {"driver": info_b, "lap": meta_b, "stats": stats_b},
        "distance": np.round(grid, 1).tolist(),
        "channels_a": _columns(da),
        "channels_b": _columns(db),
        "delta": np.round(delta, 3).tolist(),
        "final_delta": num(delta[-1]) if len(delta) else None,
        "sector_marks": _sector_marks(meta_a, da),
        "sectors": sectors,
        "minisectors": minis,
        "dominance": {
            "a": sum(1 for m in minis if m["winner"] == "a"),
            "b": sum(1 for m in minis if m["winner"] == "b"),
        },
    }
