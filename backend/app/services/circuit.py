"""Circuit geometry: outline, corners, sectors and DRS zones."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from fastf1.core import Lap, Session
from scipy.signal import find_peaks

from app.core.serialize import integer, num, seconds, text


def reference_lap(session: Session) -> Lap:
    """Fastest lap that actually has positional data."""
    laps = session.laps[session.laps["LapTime"].notna()].sort_values("LapTime")
    for _, lap in laps.head(10).iterrows():
        try:
            pos = lap.get_pos_data()
            if pos is not None and len(pos) > 50:
                return lap
        except Exception:
            continue
    return session.laps.iloc[len(session.laps) // 2]


def lap_trace(lap: Lap) -> pd.DataFrame:
    """Car channels + interpolated X/Y, indexed by lap distance."""
    car = lap.get_car_data().add_distance()
    pos = lap.get_pos_data()
    t_car = car["SessionTime"].dt.total_seconds().to_numpy()
    t_pos = pos["SessionTime"].dt.total_seconds().to_numpy()
    frame = pd.DataFrame(
        {
            "distance": car["Distance"].to_numpy(dtype=float),
            "time": car["Time"].dt.total_seconds().to_numpy(),
            "speed": car["Speed"].to_numpy(dtype=float),
            "throttle": car["Throttle"].to_numpy(dtype=float),
            "brake": car["Brake"].astype(float).to_numpy(),
            "rpm": car["RPM"].to_numpy(dtype=float),
            "gear": car["nGear"].to_numpy(dtype=float),
            "drs": car["DRS"].to_numpy(dtype=float),
            "x": np.interp(t_car, t_pos, pos["X"].to_numpy(dtype=float)),
            "y": np.interp(t_car, t_pos, pos["Y"].to_numpy(dtype=float)),
        }
    )
    frame = frame.drop_duplicates(subset="distance").sort_values("distance")
    return frame.reset_index(drop=True)


def _pca_rotation(x: np.ndarray, y: np.ndarray) -> float:
    pts = np.vstack([x - x.mean(), y - y.mean()])
    cov = np.cov(pts)
    eigvals, eigvecs = np.linalg.eigh(cov)
    major = eigvecs[:, np.argmax(eigvals)]
    angle = np.degrees(np.arctan2(major[1], major[0]))
    return float(-angle)


def _detect_corners(trace: pd.DataFrame) -> list[dict[str, Any]]:
    """Fallback corner detection: prominent local minima of speed."""
    speed = trace["speed"].rolling(3, center=True, min_periods=1).mean().to_numpy()
    step = max(1.0, float(np.median(np.diff(trace["distance"].to_numpy()))))
    peaks, _ = find_peaks(-speed, prominence=4, distance=max(1, int(60 / step)))
    corners = []
    for i, idx in enumerate(peaks, start=1):
        row = trace.iloc[idx]
        corners.append(
            {
                "number": i,
                "letter": "",
                "x": num(row["x"], 1),
                "y": num(row["y"], 1),
                "angle": 0.0,
                "distance": num(row["distance"], 1),
            }
        )
    return corners


def _drs_zones(session: Session, length: float) -> list[dict[str, float]]:
    """Union of DRS-open stretches across the session's quickest laps."""
    grid = np.arange(0.0, length, 10.0)
    hits = np.zeros(len(grid), dtype=bool)
    laps = session.laps[session.laps["LapTime"].notna()].sort_values("LapTime")
    for _, lap in laps.head(25).iterrows():
        try:
            car = lap.get_car_data().add_distance()
        except Exception:
            continue
        d = car["Distance"].to_numpy(dtype=float)
        if len(d) < 10 or d[-1] <= 0:
            continue
        d = d * (length / d[-1])
        idx = np.clip(np.searchsorted(d, grid), 0, len(d) - 1)
        hits |= car["DRS"].to_numpy()[idx] >= 10
    open_mask = hits
    zones = []
    start = None
    dist = grid
    for i, is_open in enumerate(open_mask):
        if is_open and start is None:
            start = dist[i]
        elif not is_open and start is not None:
            if dist[i] - start > 150:
                zones.append({"start": round(float(start), 1), "end": round(float(dist[i]), 1)})
            start = None
    if start is not None and dist[-1] - start > 150:
        zones.append({"start": round(float(start), 1), "end": round(float(dist[-1]), 1)})
    return zones


def _sector_distances(lap: Lap, trace: pd.DataFrame) -> list[float]:
    s1 = seconds(lap.get("Sector1Time"))
    s2 = seconds(lap.get("Sector2Time"))
    out = []
    time = trace["time"].to_numpy()
    dist = trace["distance"].to_numpy()
    if s1 is not None:
        out.append(round(float(np.interp(s1, time, dist)), 1))
        if s2 is not None:
            out.append(round(float(np.interp(s1 + s2, time, dist)), 1))
    return out


def corner_table(session: Session) -> tuple[list[dict[str, Any]], float | None, str]:
    try:
        info = session.get_circuit_info()
        corners_df = info.corners
        if corners_df is None or corners_df.empty:
            raise ValueError("empty corners")
        corners = [
            {
                "number": integer(r["Number"]),
                "letter": text(r.get("Letter"), "") or "",
                "x": num(r["X"], 1),
                "y": num(r["Y"], 1),
                "angle": num(r.get("Angle"), 1) or 0.0,
                "distance": num(r.get("Distance"), 1),
            }
            for _, r in corners_df.iterrows()
        ]
        return corners, num(info.rotation, 2), "official"
    except Exception:
        return [], None, "detected"


def circuit(session: Session) -> dict[str, Any]:
    lap = reference_lap(session)
    trace = lap_trace(lap)
    corners, rotation, source = corner_table(session)
    if not corners:
        corners = _detect_corners(trace)
    if rotation is None:
        rotation = round(_pca_rotation(trace["x"].to_numpy(), trace["y"].to_numpy()), 2)

    total = float(trace["distance"].iloc[-1])
    # Downsample the outline to ~600 points; plenty for an SVG path.
    stride = max(1, len(trace) // 600)
    outline = trace.iloc[::stride]
    return {
        "length": round(total, 1),
        "rotation": rotation,
        "corner_source": source,
        "reference": {
            "driver": text(lap.get("Driver")),
            "lap": integer(lap.get("LapNumber")),
            "time": seconds(lap.get("LapTime")),
        },
        "outline": {
            "x": [round(float(v), 1) for v in outline["x"]],
            "y": [round(float(v), 1) for v in outline["y"]],
            "distance": [round(float(v), 1) for v in outline["distance"]],
        },
        "corners": corners,
        "sectors": _sector_distances(lap, trace),
        "drs_zones": _drs_zones(session, total),
    }


def elevation(session: Session) -> dict[str, Any]:
    """Track outline in 3D (x, y, z in metres) from the reference lap's position data."""
    lap = reference_lap(session)
    trace = lap_trace(lap)
    pos = lap.get_pos_data()
    if pos is None or "Z" not in pos or pos["Z"].isna().all():
        raise common_not_found("No elevation data for this circuit.")
    car = lap.get_car_data()
    t_car = car["SessionTime"].dt.total_seconds().to_numpy()
    t_pos = pos["SessionTime"].dt.total_seconds().to_numpy()
    z_raw = np.interp(t_car, t_pos, pos["Z"].to_numpy(dtype=float))
    # lap_trace sorted/deduplicated by distance; rebuild z on the same index.
    dist_car = car.add_distance()["Distance"].to_numpy(dtype=float)
    order = np.argsort(dist_car)
    z = np.interp(trace["distance"].to_numpy(), dist_car[order], z_raw[order])
    # Position data is in 1/10 m; smooth the 4 Hz steps.
    kernel = np.ones(9) / 9
    z = np.convolve(np.pad(z, 4, mode="edge"), kernel, mode="valid")
    stride = max(1, len(trace) // 900)
    sl = slice(None, None, stride)
    x = trace["x"].to_numpy()[sl] / 10
    y = trace["y"].to_numpy()[sl] / 10
    zz = z[sl] / 10
    return {
        "length": round(float(trace["distance"].iloc[-1]), 1),
        "x": np.round(x, 2).tolist(),
        "y": np.round(y, 2).tolist(),
        "z": np.round(zz, 2).tolist(),
        "distance": np.round(trace["distance"].to_numpy()[sl], 1).tolist(),
        "elevation_range": round(float(zz.max() - zz.min()), 1),
        "lowest": round(float(zz.min()), 2),
        "highest": round(float(zz.max()), 2),
    }


def common_not_found(message: str) -> Exception:
    from app.core.errors import NotFoundError

    return NotFoundError(message)
