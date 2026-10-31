"""Weather time series, summary statistics and a wind rose."""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Session

from app.core.serialize import num

DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
SPEED_BINS = [0, 1, 2, 3, 4, 6, 100]  # m/s


def weather(session: Session) -> dict[str, Any]:
    w = getattr(session, "weather_data", None)
    if w is None or w.empty:
        return {"series": None, "summary": None, "wind_rose": [], "rain_windows": []}

    w = w.dropna(subset=["Time"]).reset_index(drop=True)
    minutes = (w["Time"].dt.total_seconds() / 60).round(2)
    series = {
        "minute": minutes.tolist(),
        "air_temp": [num(v, 1) for v in w["AirTemp"]],
        "track_temp": [num(v, 1) for v in w["TrackTemp"]],
        "humidity": [num(v, 1) for v in w["Humidity"]],
        "pressure": [num(v, 1) for v in w["Pressure"]],
        "wind_speed": [num(v, 2) for v in w["WindSpeed"]],
        "wind_direction": [num(v, 0) for v in w["WindDirection"]],
        "rainfall": [bool(v) for v in w["Rainfall"].astype(bool)],
    }

    def stats(col: str, digits: int = 1) -> dict[str, float | None]:
        values = w[col].astype(float)
        return {
            "min": num(values.min(), digits),
            "max": num(values.max(), digits),
            "mean": num(values.mean(), digits),
            "start": num(values.iloc[0], digits),
            "end": num(values.iloc[-1], digits),
        }

    summary = {
        "air_temp": stats("AirTemp"),
        "track_temp": stats("TrackTemp"),
        "humidity": stats("Humidity", 0),
        "pressure": stats("Pressure"),
        "wind_speed": stats("WindSpeed", 2),
        "rain_share": num(w["Rainfall"].astype(bool).mean() * 100, 1),
        "samples": int(len(w)),
    }

    # Wind rose: frequency (%) by 8 compass sectors x speed band.
    direction = w["WindDirection"].astype(float).to_numpy()
    speed = w["WindSpeed"].astype(float).to_numpy()
    sector = ((direction + 22.5) // 45).astype(int) % 8
    rose = []
    total = max(1, len(w))
    for i, label in enumerate(DIRECTIONS):
        mask = sector == i
        bands = []
        for lo, hi in zip(SPEED_BINS[:-1], SPEED_BINS[1:]):
            count = int(np.count_nonzero(mask & (speed >= lo) & (speed < hi)))
            bands.append({"from": lo, "to": hi, "share": round(count / total * 100, 2)})
        rose.append(
            {
                "direction": label,
                "share": round(int(mask.sum()) / total * 100, 2),
                "bands": bands,
            }
        )

    rain_windows = []
    raining = w["Rainfall"].astype(bool).to_numpy()
    start = None
    for i, r in enumerate(raining):
        if r and start is None:
            start = minutes.iloc[i]
        elif not r and start is not None:
            rain_windows.append({"start": float(start), "end": float(minutes.iloc[i])})
            start = None
    if start is not None:
        rain_windows.append({"start": float(start), "end": float(minutes.iloc[-1])})

    return {
        "series": series,
        "summary": summary,
        "wind_rose": rose,
        "rain_windows": rain_windows,
    }
