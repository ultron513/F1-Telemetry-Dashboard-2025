"""Compact, model-friendly facts about a session.

These helpers turn the dashboard payloads into small dictionaries of plain
numbers and sentences-in-waiting. Both the template report and the language
model only ever see these, which keeps answers grounded and prompts short.
"""

from __future__ import annotations

import re
from typing import Any

from app.api import payloads
from app.core.errors import DomainError, NotFoundError
from app.data.schedule import SessionRef


def r(value: float | None, digits: int = 3) -> float | None:
    return None if value is None else round(float(value), digits)


def fmt_time(seconds: float | None) -> str:
    if seconds is None:
        return "—"
    minutes, secs = divmod(seconds, 60)
    return f"{int(minutes)}:{secs:06.3f}" if minutes else f"{secs:.3f}s"


def safe(fn, *args, **kwargs) -> Any | None:
    """Call a payload builder; return None when that data doesn't exist."""
    try:
        return fn(*args, **kwargs)
    except DomainError:
        return None


# --- Driver resolution -------------------------------------------------------


def _norm(text: str) -> str:
    return re.sub(r"[^a-z]", "", text.lower())


def driver_aliases(ref: SessionRef) -> dict[str, list[str]]:
    """alias → driver codes. Team names map to both drivers."""
    out: dict[str, list[str]] = {}
    for d in payloads.summary(ref)["drivers"]:
        names = {d["code"], d.get("last_name", ""), d.get("first_name", ""), d["full_name"]}
        if d.get("number"):
            names.add(f"car{d['number']}")
        for n in names:
            if n and len(_norm(n)) >= 3:
                out.setdefault(_norm(n), []).append(d["code"])
        team = _norm(d["team"])
        out.setdefault(team, []).append(d["code"])
        # Common short team names ("red bull racing" → "redbull", "ferrari").
        for short in (team.replace("racing", ""), team.split("f1team")[0]):
            if len(short) >= 4 and short != team:
                out.setdefault(short, []).append(d["code"])
    return {k: sorted(set(v), key=v.index) for k, v in out.items()}


def find_drivers(ref: SessionRef, text: str) -> list[str]:
    """Driver codes mentioned in free text, in order of appearance."""
    aliases = driver_aliases(ref)
    hits: list[tuple[int, str]] = []
    lowered = text.lower()
    for alias, codes in aliases.items():
        # Match whole words only; aliases are normalised (letters only).
        pattern = r"(?<![a-z])" + r"[\s\-']*".join(map(re.escape, alias)) + r"(?![a-z])"
        m = re.search(pattern, lowered)
        if m:
            hits.extend((m.start(), c) for c in codes)
    ordered: list[str] = []
    for _, code in sorted(hits):
        if code not in ordered:
            ordered.append(code)
    return ordered


def require_driver(ref: SessionRef, code: str) -> dict[str, Any]:
    code = code.upper()
    for d in payloads.summary(ref)["drivers"]:
        if d["code"] == code:
            return d
    raise NotFoundError(f"{code} didn't take part in this session.")


# --- Session-level facts ------------------------------------------------------


def results_table(ref: SessionRef, limit: int = 20) -> list[dict[str, Any]]:
    rows = payloads.summary(ref)["results"]
    out = []
    for row in rows[:limit]:
        out.append(
            {
                "pos": row.get("position"),
                "driver": row["code"],
                "team": row["team"],
                "grid": row.get("grid"),
                "status": row.get("status"),
                "gap_s": r(row.get("gap")),
                "points": row.get("points"),
                "best_lap": fmt_time(row.get("best_lap")),
                "q3": fmt_time(row.get("q3")) if row.get("q3") else None,
            }
        )
    return out


def lead_changes(ref: SessionRef) -> list[dict[str, Any]]:
    trace = safe(payloads.race_trace, ref)
    if not trace:
        return []
    leader_by_lap: dict[int, str] = {}
    for d in trace["drivers"]:
        for p in d["points"]:
            if p.get("position") == 1:
                leader_by_lap[p["lap"]] = d["code"]
    changes, prev = [], None
    for lap in sorted(leader_by_lap):
        code = leader_by_lap[lap]
        if prev and code != prev:
            changes.append({"lap": lap, "from": prev, "to": code})
        prev = code
    return changes


def track_events(ref: SessionRef) -> list[dict[str, Any]]:
    rc = safe(payloads.race_control, ref)
    if not rc:
        return []
    kinds = {
        "4": "Safety Car",
        "5": "Red Flag",
        "6": "Virtual Safety Car",
        "7": "Virtual Safety Car",
    }
    events = []
    for seg in rc["track_status"]:
        if seg["status"] in kinds:
            events.append(
                {
                    "kind": kinds[seg["status"]],
                    "start_lap": seg.get("start_lap"),
                    "end_lap": seg.get("end_lap"),
                }
            )
    # Collapse consecutive segments of the same kind (e.g. VSC deployed/ending).
    merged: list[dict[str, Any]] = []
    for e in events:
        if (
            merged
            and merged[-1]["kind"] == e["kind"]
            and merged[-1]["end_lap"]
            in (
                e["start_lap"],
                None,
            )
        ):
            merged[-1]["end_lap"] = e["end_lap"]
        else:
            merged.append(e)
    return merged


def stewards(ref: SessionRef, limit: int = 12) -> list[dict[str, Any]]:
    rc = safe(payloads.race_control, ref)
    if not rc:
        return []
    out = []
    for m in rc["messages"]:
        if m["kind"] in {"penalty", "black_white"}:
            out.append({"lap": m.get("lap"), "kind": m["kind"], "message": m["message"]})
    return out[:limit]


def movers(ref: SessionRef) -> dict[str, list[dict[str, Any]]]:
    gains = []
    for row in payloads.summary(ref)["results"]:
        grid, pos = row.get("grid"), row.get("position")
        if grid and pos and grid > 0:
            gains.append({"driver": row["code"], "grid": grid, "finish": pos, "gained": grid - pos})
    gains.sort(key=lambda g: g["gained"], reverse=True)
    return {
        "gainers": [g for g in gains if g["gained"] > 0][:3],
        "losers": [g for g in reversed(gains) if g["gained"] < 0][:3],
    }


def driver_strategy(ref: SessionRef, code: str) -> dict[str, Any] | None:
    strat = safe(payloads.strategy, ref)
    if not strat:
        return None
    stints = next((d["stints"] for d in strat["stints"] if d["code"] == code), [])
    stops = [p for p in strat["pit_stops"] if p["code"] == code]
    return {
        "stints": [
            {
                "compound": s["compound"],
                "laps": f"{s.get('start_lap')}–{s.get('end_lap')}",
                "length": s["laps"],
                "avg": r(s.get("average")),
                "deg_s_per_lap": r(s.get("fuel_corrected_degradation") or s.get("degradation")),
            }
            for s in stints
        ],
        "stops": [
            {
                "lap": p.get("lap"),
                "pit_lane_s": r(p.get("pit_lane_time"), 1),
                "to": p.get("to_compound"),
                "under": p.get("under"),
            }
            for p in stops
        ],
    }


def strategy_overview(ref: SessionRef, top: int = 10) -> dict[str, Any] | None:
    strat = safe(payloads.strategy, ref)
    if not strat:
        return None
    order = [row["code"] for row in payloads.summary(ref)["results"]][:top]
    plans = {}
    for d in strat["stints"]:
        if d["code"] in order:
            plans[d["code"]] = "-".join(s["compound"][:1] for s in d["stints"]) or "—"
    counts: dict[int, int] = {}
    for d in strat["stints"]:
        n = max(0, len(d["stints"]) - 1)
        counts[n] = counts.get(n, 0) + 1
    fastest = strat.get("fastest_pit_lane")
    return {
        "plans_top": [{"driver": c, "plan": plans.get(c, "—")} for c in order],
        "stops_count": {f"{k}-stop": v for k, v in sorted(counts.items())},
        "pit_loss_s": r(strat.get("pit_loss"), 1),
        "fastest_pit_lane": fastest
        and {
            "driver": fastest["code"],
            "lap": fastest.get("lap"),
            "s": r(fastest.get("pit_lane_time"), 2),
        },
        "compound_deg_s_per_lap": {k: r(v) for k, v in strat["compound_degradation"].items()},
    }


def pace_ranking(ref: SessionRef, top: int = 10) -> list[dict[str, Any]]:
    pace = safe(payloads.field_pace, ref)
    if not pace:
        return []
    rows = [d for d in pace["drivers"] if d.get("median") is not None]
    rows.sort(key=lambda d: d["median"])
    return [
        {"driver": d["code"], "median": fmt_time(d["median"]), "gap_s": r(d.get("gap_to_best"))}
        for d in rows[:top]
    ]


def weather_brief(ref: SessionRef) -> dict[str, Any] | None:
    w = safe(payloads.weather, ref)
    if not w or not w.get("summary"):
        return None
    s = w["summary"]
    return {
        "air_c": [r(s["air_temp"]["min"], 1), r(s["air_temp"]["max"], 1)],
        "track_c": [r(s["track_temp"]["min"], 1), r(s["track_temp"]["max"], 1)],
        "humidity_pct": r(s["humidity"]["mean"], 0),
        "wind_ms": r(s["wind_speed"]["mean"], 1),
        "rain_share": r(s.get("rain_share"), 2),
        "rain_windows_min": [[r(x["start"], 0), r(x["end"], 0)] for x in w["rain_windows"]],
    }


def gap_series(ref: SessionRef, a: str, b: str) -> list[tuple[int, float]]:
    """Per-lap gap of B behind A in seconds (positive: B behind)."""
    trace = safe(payloads.race_trace, ref)
    if not trace:
        return []
    by = {d["code"]: {p["lap"]: p.get("gap") for p in d["points"]} for d in trace["drivers"]}
    if a not in by or b not in by:
        return []
    laps = sorted(set(by[a]) & set(by[b]))
    return [
        (lap, round(by[b][lap] - by[a][lap], 3))
        for lap in laps
        if by[a][lap] is not None and by[b][lap] is not None
    ]


def head_to_head(ref: SessionRef, a: str, b: str) -> dict[str, Any]:
    """Everything needed to explain why one driver finished ahead of another."""
    da, db = require_driver(ref, a), require_driver(ref, b)
    rows = {row["code"]: row for row in payloads.summary(ref)["results"]}
    ra, rb = rows.get(a, {}), rows.get(b, {})
    out: dict[str, Any] = {
        "a": {"driver": a, "name": da["full_name"], "team": da["team"]},
        "b": {"driver": b, "name": db["full_name"], "team": db["team"]},
        "grid": [ra.get("grid"), rb.get("grid")],
        "finish": [ra.get("position"), rb.get("position")],
        "status": [ra.get("status"), rb.get("status")],
    }

    pace = safe(payloads.field_pace, ref)
    if pace:
        med = {d["code"]: d.get("median") for d in pace["drivers"]}
        if med.get(a) and med.get(b):
            out["median_pace"] = [fmt_time(med[a]), fmt_time(med[b])]
            out["median_pace_delta_s"] = r(med[b] - med[a])  # positive: A quicker

    cmp = safe(payloads.compare, ref, a, "fastest", b, "fastest")
    if cmp:
        out["fastest_lap"] = [fmt_time(cmp["a"]["lap"]["time"]), fmt_time(cmp["b"]["lap"]["time"])]
        out["fastest_lap_delta_s"] = r(cmp["final_delta"])  # positive: A quicker
        out["sectors_delta_s"] = {s["sector"]: r(s["delta"]) for s in cmp["sectors"]}
        out["top_speed_kmh"] = [
            r(cmp["a"]["stats"].get("max_speed"), 1),
            r(cmp["b"]["stats"].get("max_speed"), 1),
        ]
        out["minisectors_won"] = [cmp["dominance"]["a"], cmp["dominance"]["b"]]

    if ref.kind == "race":
        out["strategy"] = {a: driver_strategy(ref, a), b: driver_strategy(ref, b)}
        gaps = gap_series(ref, a, b)
        if gaps:
            swaps = [
                gaps[i][0] for i in range(1, len(gaps)) if (gaps[i - 1][1] > 0) != (gaps[i][1] > 0)
            ]
            out["gap_b_behind_a"] = {
                "first_lap": gaps[0][1],
                "max": max(g for _, g in gaps),
                "min": min(g for _, g in gaps),
                "final": gaps[-1][1],
                "order_swaps_on_laps": swaps[:8],
            }
            # Largest single-lap swings explain pit stops, incidents and safety cars.
            swings = sorted(
                ((gaps[i][0], round(gaps[i][1] - gaps[i - 1][1], 2)) for i in range(1, len(gaps))),
                key=lambda s: abs(s[1]),
                reverse=True,
            )
            out["biggest_gap_swings"] = [{"lap": lap, "change_s": ch} for lap, ch in swings[:4]]
    return out
