"""Session replay: every car's race progress sampled on a fixed clock.

Rather than streaming raw X/Y (huge, and linear interpolation cuts
corners), each car's position is expressed as *progress* — completed laps
plus the fraction of the current lap, measured by integrated distance
between that lap's start and end. The client maps the fractional part back
onto the circuit outline, so cars always move along the racing line.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Session

from app.core.serialize import integer, is_missing, text
from app.services import common


def _cumulative_distance(t: np.ndarray, speed_kmh: np.ndarray) -> np.ndarray:
    v = speed_kmh / 3.6
    dt = np.diff(t, prepend=t[0])
    return np.cumsum(0.5 * (v + np.concatenate([[v[0]], v[:-1]])) * dt)


def replay(session: Session, step: float = 1.0) -> dict[str, Any]:
    laps = session.laps.dropna(subset=["LapNumber"])
    starts = laps["LapStartTime"].dropna()
    ends = laps["Time"].dropna()
    if starts.empty or ends.empty:
        raise common.NotFoundError("This session has no lap timing to replay.")

    t_start = float(starts.min().total_seconds())
    t_end = float(ends.max().total_seconds())
    frames = np.arange(t_start, t_end + step, step)

    lookup = common.driver_lookup(session)
    cars = getattr(session, "car_data", {}) or {}
    max_lap = int(laps["LapNumber"].max())
    out_drivers = []

    for code, info in lookup.items():
        number = info["number"]
        car = cars.get(number)
        dl = laps[laps["Driver"] == code].sort_values("LapNumber")
        if car is None or car.empty or dl.empty:
            continue
        t_car = car["SessionTime"].dt.total_seconds().to_numpy()
        dist = _cumulative_distance(t_car, car["Speed"].to_numpy(dtype=float))

        lap_no = dl["LapNumber"].to_numpy(dtype=int)
        lap_start = dl["LapStartTime"].dt.total_seconds().to_numpy()
        lap_end = dl["Time"].dt.total_seconds().to_numpy()
        # Repair gaps: a missing start is the previous lap's end.
        for i in range(len(lap_start)):
            if np.isnan(lap_start[i]) and i > 0:
                lap_start[i] = lap_end[i - 1]
        valid = ~np.isnan(lap_start) & ~np.isnan(lap_end) & (lap_end > lap_start)
        lap_no, lap_start, lap_end = lap_no[valid], lap_start[valid], lap_end[valid]
        if len(lap_no) == 0:
            continue

        d_start = np.interp(lap_start, t_car, dist)
        d_end = np.interp(lap_end, t_car, dist)
        d_frames = np.interp(frames, t_car, dist)

        idx = np.searchsorted(lap_start, frames, side="right") - 1
        progress = np.zeros(len(frames))
        before = idx < 0
        idx_c = np.clip(idx, 0, len(lap_no) - 1)
        span = np.maximum(d_end[idx_c] - d_start[idx_c], 1.0)
        frac = np.clip((d_frames - d_start[idx_c]) / span, 0.0, 0.999)
        progress = (lap_no[idx_c] - 1) + frac
        progress[before] = 0.0
        # After the final recorded lap, park the car on the line.
        finished_at = lap_end[-1]
        after = frames > finished_at
        progress[after] = float(lap_no[-1])

        pits = []
        dl_r = dl.reset_index(drop=True)
        for i, lap in dl_r.iterrows():
            if is_missing(lap.get("PitInTime")):
                continue
            out_time = None
            if i + 1 < len(dl_r) and not is_missing(dl_r.loc[i + 1, "PitOutTime"]):
                out_time = float(dl_r.loc[i + 1, "PitOutTime"].total_seconds())
            pits.append(
                {
                    "start": round(float(lap["PitInTime"].total_seconds()), 1),
                    "end": round(out_time, 1) if out_time else None,
                    "lap": integer(lap["LapNumber"]),
                }
            )

        stints = []
        for _stint, group in dl.groupby("Stint"):
            stints.append(
                {
                    "compound": text(group["Compound"].iloc[0], "UNKNOWN"),
                    "start_lap": integer(group["LapNumber"].min()),
                    "end_lap": integer(group["LapNumber"].max()),
                }
            )

        completed = int(lap_no[-1])
        grid = (
            integer(session.results.loc[number, "GridPosition"])
            if number in session.results.index
            else None
        )
        if not grid:
            first = dl[dl["LapNumber"] == 1]
            grid = integer(first["Position"].iloc[0]) if not first.empty else None
        out_drivers.append(
            {
                "code": code,
                "number": number,
                "team": info["team"],
                "team_color": info["team_color"],
                "progress": np.round(progress * 1000).astype(int).tolist(),
                "finished_at": round(float(finished_at), 1),
                "retired": completed < max_lap - 3,
                "grid": grid,
                "laps_completed": completed,
                "pits": pits,
                "stints": stints,
            }
        )

    return {
        "start": round(t_start, 1),
        "end": round(t_end, 1),
        "step": step,
        "frames": int(len(frames)),
        "total_laps": common.total_laps(session),
        "progress_scale": 1000,
        "drivers": out_drivers,
    }


def onboard(session: Session, code: str, step: float = 0.5) -> dict[str, Any]:
    """One car's dashboard channels on the replay clock (for the onboard HUD)."""
    info = common.require_driver(session, code)
    laps = session.laps.dropna(subset=["LapNumber"])
    t_start = float(laps["LapStartTime"].dropna().min().total_seconds())
    t_end = float(laps["Time"].dropna().max().total_seconds())
    car = (getattr(session, "car_data", {}) or {}).get(info["number"])
    if car is None or car.empty:
        raise common.NotFoundError(f"No car data for {code} in this session.")
    t = car["SessionTime"].dt.total_seconds().to_numpy()
    frames = np.arange(t_start, t_end + step, step)
    idx = np.clip(np.searchsorted(t, frames), 0, len(t) - 1)

    def cont(col: str) -> list[int]:
        return np.round(np.interp(frames, t, car[col].to_numpy(dtype=float))).astype(int).tolist()

    def disc(col: str) -> list[int]:
        return car[col].to_numpy()[idx].astype(int).tolist()

    return {
        "driver": info,
        "start": round(t_start, 1),
        "step": step,
        "frames": int(len(frames)),
        "speed": cont("Speed"),
        "rpm": cont("RPM"),
        "throttle": np.clip(cont("Throttle"), 0, 100).tolist(),
        "brake": [int(bool(v)) for v in car["Brake"].to_numpy()[idx]],
        "gear": disc("nGear"),
        "drs": [1 if v >= 10 else 0 for v in car["DRS"].to_numpy()[idx]],
        "max_rpm": int(car["RPM"].max()),
    }
