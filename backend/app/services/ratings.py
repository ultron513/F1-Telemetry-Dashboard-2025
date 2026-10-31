"""Field-relative driver ratings for a single session.

Each metric is measured from timing data, then mapped linearly onto a
60–99 scale between the worst and best driver in the session, so the
numbers read like broadcast-style ratings while staying data-driven.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from fastf1.core import Session

from app.core.serialize import num
from app.data.schedule import SessionRef
from app.services import common
from app.services.strategy import FUEL_EFFECT_PER_LAP, _fit

METRICS = {
    "one_lap": {"label": "One-lap pace", "higher_is_better": False, "unit": "%"},
    "race_pace": {"label": "Long-run pace", "higher_is_better": False, "unit": "%"},
    "consistency": {"label": "Consistency", "higher_is_better": False, "unit": "s"},
    "top_speed": {"label": "Straight-line speed", "higher_is_better": True, "unit": "km/h"},
    "tyre_management": {"label": "Tyre management", "higher_is_better": False, "unit": "s/lap"},
    "racecraft": {"label": "Racecraft", "higher_is_better": True, "unit": "pos"},
}

WEIGHTS = {
    "race": {
        "one_lap": 0.15,
        "race_pace": 0.3,
        "consistency": 0.15,
        "top_speed": 0.1,
        "tyre_management": 0.15,
        "racecraft": 0.15,
    },
    "qualifying": {
        "one_lap": 0.6,
        "race_pace": 0.0,
        "consistency": 0.15,
        "top_speed": 0.25,
        "tyre_management": 0.0,
        "racecraft": 0.0,
    },
    "practice": {
        "one_lap": 0.35,
        "race_pace": 0.3,
        "consistency": 0.2,
        "top_speed": 0.15,
        "tyre_management": 0.0,
        "racecraft": 0.0,
    },
}


def _raw_metrics(session: Session, kind: str) -> dict[str, dict[str, float | None]]:
    lookup = common.driver_lookup(session)
    best_lap = session.laps["LapTime"].min().total_seconds()
    raw: dict[str, dict[str, float | None]] = {}
    medians: dict[str, float] = {}
    max_laps = int(session.laps["LapNumber"].max() or 1)
    # Long-run metrics need a representative sample, or a driver who
    # retired early gets an extreme score from a handful of laps.
    min_clean = max(5, int(0.3 * max_laps)) if kind == "race" else 3
    for code in lookup:
        laps = session.laps.pick_drivers(code)
        if laps.empty:
            continue
        clean = common.clean_laps(laps)
        times = common.lap_seconds(clean)
        best = laps["LapTime"].min()
        m: dict[str, float | None] = {k: None for k in METRICS}
        if not common.is_missing(best):
            m["one_lap"] = (best.total_seconds() - best_lap) / best_lap * 100
        if len(times) >= min_clean:
            medians[code] = float(np.median(times))
            q75, q25 = np.percentile(times, [75, 25])
            m["consistency"] = float(q75 - q25)
        speeds = laps["SpeedST"].dropna()
        if not speeds.empty:
            m["top_speed"] = float(speeds.max())
        if kind == "race" and len(laps) >= 0.5 * max_laps:
            slopes = []
            for _, group in laps.groupby("Stint"):
                g = common.clean_laps(group)
                if len(g) >= 6:
                    slope, _, _ = _fit(g["TyreLife"].to_numpy(dtype=float), common.lap_seconds(g))
                    if slope is not None:
                        slopes.append(slope + FUEL_EFFECT_PER_LAP)
            if slopes:
                m["tyre_management"] = float(np.mean(slopes))
            ordered = laps.sort_values("LapNumber")["Position"].dropna()
            finished = laps["LapNumber"].max() >= max_laps - 1
            if finished and len(ordered) > 1:
                m["racecraft"] = float(ordered.iloc[0] - ordered.iloc[-1])
        raw[code] = m
    if medians:
        ref = min(medians.values())
        for code, med in medians.items():
            raw[code]["race_pace"] = (med - ref) / ref * 100
    return raw


def _scale(values: dict[str, float | None], higher_is_better: bool) -> dict[str, float | None]:
    present = {k: v for k, v in values.items() if v is not None}
    if len(present) < 2:
        return {k: (80.0 if v is not None else None) for k, v in values.items()}
    lo, hi = min(present.values()), max(present.values())
    out: dict[str, float | None] = {}
    for k, v in values.items():
        if v is None:
            out[k] = None
            continue
        frac = 0.5 if hi == lo else (v - lo) / (hi - lo)
        if not higher_is_better:
            frac = 1 - frac
        out[k] = round(60 + frac * 39, 1)
    return out


def ratings(ref: SessionRef, session: Session) -> dict[str, Any]:
    kind = ref.kind
    raw = _raw_metrics(session, kind)
    lookup = common.driver_lookup(session)
    scaled: dict[str, dict[str, float | None]] = {code: {} for code in raw}
    for metric, meta in METRICS.items():
        col = _scale({c: raw[c][metric] for c in raw}, meta["higher_is_better"])
        for code, v in col.items():
            scaled[code][metric] = v
    weights = WEIGHTS[kind]
    entries = []
    for code in raw:
        total, wsum = 0.0, 0.0
        used = 0
        for metric, w in weights.items():
            v = scaled[code].get(metric)
            if w and v is not None:
                total += v * w
                wsum += w
                used += 1
        if used < 3:
            wsum = 0.0  # not enough evidence for an overall rating
        entries.append(
            {
                "code": code,
                "team": lookup[code]["team"],
                "team_color": lookup[code]["team_color"],
                "overall": round(total / wsum, 1) if wsum else None,
                "scores": scaled[code],
                "raw": {k: num(v, 3) for k, v in raw[code].items()},
            }
        )
    entries.sort(key=lambda e: -(e["overall"] or 0))
    for i, e in enumerate(entries, start=1):
        e["rank"] = i
    return {
        "metrics": [{"key": k, **v, "weight": weights.get(k, 0)} for k, v in METRICS.items()],
        "drivers": entries,
    }
