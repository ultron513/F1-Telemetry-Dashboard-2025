"""The analyst's tools: small, grounded views over the session's data.

Each tool returns ``(data, charts)``. ``data`` is a compact dictionary the
analyst reasons over; ``charts`` tell the frontend which dashboard visual to
show next to the answer, so claims come with the evidence.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.ai import facts
from app.ai.llm import ToolSpec
from app.api import payloads
from app.core.errors import DomainError, InvalidParameterError
from app.data.schedule import SessionRef
from app.services.standings import standings as standings_svc

Chart = dict[str, Any]
Result = tuple[dict[str, Any], list[Chart]]

DRIVER = {"type": "string", "description": "Three-letter driver code, e.g. VER"}


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    run: Callable[..., Result]

    def spec(self) -> ToolSpec:
        return ToolSpec(self.name, self.description, self.parameters)


def _schema(props: dict[str, Any] | None = None, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props or {}, "required": required or []}


def _code(ref: SessionRef, value: Any) -> str:
    code = str(value or "").strip()
    if len(code) != 3 or not code.isalpha():
        found = facts.find_drivers(ref, code)
        if not found:
            raise InvalidParameterError(f"Unknown driver '{value}'.")
        code = found[0]
    return facts.require_driver(ref, code)["code"]


UNDERCUT_VERDICTS = {
    "undercut": "Yes — pitting first gets the attacker ahead (undercut works).",
    "overcut": "Only by staying out — the overcut works, the undercut doesn't.",
    "stay": "No — neither pitting first nor staying out gets the attacker ahead.",
    "safe": "The attacker stays ahead whatever the defender does.",
    "cover": "The car ahead must pit first to cover the undercut.",
    "stay-out": "The car ahead should stay out — pitting first would lose the place.",
    "lose": "The car ahead loses the place whatever it does.",
}
STINT_VERDICTS = {
    "insufficient-data": "not enough clean laps to judge",
    "no-degradation": "no measurable degradation — length wasn't limited by tyres",
    "deg-not-limiting": "degradation too low to force a stop",
    "overextended": "run longer than optimal — time was lost to tyre wear",
    "early": "stopped earlier than the tyres required",
    "on-target": "close to the optimal length",
}


def _race_only(ref: SessionRef, what: str) -> None:
    if ref.kind != "race":
        raise InvalidParameterError(f"{what} is only available for races and sprints.")


# --- tool implementations ------------------------------------------------------


def session_overview(ref: SessionRef) -> Result:
    s = payloads.summary(ref)
    h = s["highlights"]
    data = {
        "event": s["event"]["name"],
        "session": ref.name,
        "winner_or_fastest": h.get("winner"),
        "podium": h.get("podium"),
        "fastest_lap": h.get("fastest_lap")
        and {
            "driver": h["fastest_lap"]["driver"],
            "time": facts.fmt_time(h["fastest_lap"].get("time")),
            "lap": h["fastest_lap"].get("lap"),
        },
        "laps": h.get("total_laps"),
        "pit_stops": h.get("pit_stops"),
        "retirements": h.get("retirements"),
        "safety_cars": h.get("safety_car"),
        "vsc": h.get("vsc"),
        "red_flags": h.get("red_flag"),
        "top10": facts.results_table(ref, 10),
    }
    if ref.kind == "race":
        data["lead_changes"] = facts.lead_changes(ref)
        data["track_events"] = facts.track_events(ref)
        data["movers"] = facts.movers(ref)
    return data, [{"type": "results"}]


def results(ref: SessionRef, limit: int = 20) -> Result:
    return {"results": facts.results_table(ref, int(limit or 20))}, [{"type": "results"}]


def head_to_head(ref: SessionRef, driver_a: str, driver_b: str) -> Result:
    a, b = _code(ref, driver_a), _code(ref, driver_b)
    data = facts.head_to_head(ref, a, b)
    charts: list[Chart] = []
    if ref.kind == "race":
        charts.append({"type": "race-trace", "drivers": [a, b]})
    charts.append({"type": "compare", "a": a, "b": b})
    return data, charts


def lap_comparison(ref: SessionRef, driver_a: str, driver_b: str) -> Result:
    a, b = _code(ref, driver_a), _code(ref, driver_b)
    cmp = payloads.compare(ref, a, "fastest", b, "fastest")
    worst = sorted(cmp["minisectors"], key=lambda m: m["gain"], reverse=True)[:4]
    data = {
        "lap_times": {
            a: facts.fmt_time(cmp["a"]["lap"]["time"]),
            b: facts.fmt_time(cmp["b"]["lap"]["time"]),
        },
        "delta_s": facts.r(cmp["final_delta"]),
        "delta_meaning": f"positive means {a} was quicker",
        "sectors_delta_s": {s["sector"]: facts.r(s["delta"]) for s in cmp["sectors"]},
        "minisectors_won": {a: cmp["dominance"]["a"], b: cmp["dominance"]["b"]},
        "biggest_minisector_gaps": [
            {
                "from_m": m["start"],
                "to_m": m["end"],
                "faster": a if m["winner"] == "a" else b,
                "gain_s": m["gain"],
            }
            for m in worst
        ],
        "stats": {
            a: {
                k: cmp["a"]["stats"].get(k)
                for k in ("max_speed", "full_throttle_pct", "braking_pct", "drs_pct")
            },
            b: {
                k: cmp["b"]["stats"].get(k)
                for k in ("max_speed", "full_throttle_pct", "braking_pct", "drs_pct")
            },
        },
    }
    return data, [{"type": "compare", "a": a, "b": b}]


def strategy(ref: SessionRef, driver: str | None = None) -> Result:
    _race_only(ref, "Strategy")
    if driver:
        code = _code(ref, driver)
        return (
            {"driver": code, **(facts.driver_strategy(ref, code) or {})},
            [{"type": "strategy", "drivers": [code]}],
        )
    return facts.strategy_overview(ref) or {}, [{"type": "strategy"}]


def race_control(ref: SessionRef) -> Result:
    rc = payloads.race_control(ref)
    data = {
        "counts": rc["counts"],
        "track_events": facts.track_events(ref),
        "penalties": facts.stewards(ref),
        "investigations": [
            {"lap": m.get("lap"), "message": m["message"]}
            for m in rc["messages"]
            if m["kind"] == "investigation"
        ][:10],
    }
    return data, [{"type": "race-control"}]


def pace(ref: SessionRef) -> Result:
    return {"median_lap_pace": facts.pace_ranking(ref, 12)}, [{"type": "pace"}]


def tyre_degradation(ref: SessionRef, driver: str) -> Result:
    _race_only(ref, "Tyre degradation")
    code = _code(ref, driver)
    rec = payloads.recommendation(ref, code)
    data = {
        "driver": code,
        "pit_loss_s": facts.r(rec["pit_loss"], 1),
        "risk": rec["risk"],
        "stints": [
            {
                "compound": s["compound"],
                "laps": s["laps"],
                "deg_s_per_lap": facts.r(s.get("degradation")),
                "optimal_length": facts.r(s.get("optimal_length"), 0),
                "verdict": STINT_VERDICTS.get(s["verdict"], s["verdict"]),
            }
            for s in rec["stints"]
        ],
    }
    return data, [{"type": "degradation", "driver": code}]


def undercut(ref: SessionRef, attacker: str, defender: str, lap: int) -> Result:
    _race_only(ref, "The undercut calculator")
    a, d = _code(ref, attacker), _code(ref, defender)
    u = payloads.sim_undercut(ref, a, d, int(lap), None)
    data = {
        "attacker": a,
        "defender": d,
        "lap": u["lap"],
        "gap_s": facts.r(u.get("gap")),
        "fresh_tyre_gain_s_per_lap": facts.r(u.get("fresh_tyre_gain")),
        "pit_loss_s": facts.r(u.get("pit_loss"), 1),
        "undercut": {
            "final_gap_s": facts.r(u["undercut"].get("final_gap")),
            "attacker_ahead": u["undercut"]["attacker_ahead"],
        },
        "overcut": {
            "final_gap_s": facts.r(u["overcut"].get("final_gap")),
            "attacker_ahead": u["overcut"]["attacker_ahead"],
        },
        "verdict": UNDERCUT_VERDICTS.get(u["verdict"], u["verdict"]),
    }
    return data, [{"type": "undercut", "attacker": a, "defender": d, "lap": u["lap"]}]


def weather(ref: SessionRef) -> Result:
    return facts.weather_brief(ref) or {"note": "No weather data."}, [{"type": "weather"}]


def championship(ref: SessionRef) -> Result:
    st = standings_svc(ref.season, ref.round)
    data = {
        "after_round": ref.round,
        "drivers": [
            {"pos": d["position"], "driver": d["code"], "points": d.get("points")}
            for d in st.get("drivers", [])[:10]
        ],
        "constructors": [
            {
                "pos": c["position"],
                "team": c.get("name") or c.get("team"),
                "points": c.get("points"),
            }
            for c in st.get("constructors", [])[:10]
        ],
    }
    return data, [{"type": "standings"}]


TOOLS: dict[str, Tool] = {
    t.name: t
    for t in [
        Tool(
            "session_overview",
            "Winner/podium, fastest lap, lead changes, safety cars, retirements and the top 10. "
            "Start here for general questions.",
            _schema(),
            session_overview,
        ),
        Tool(
            "results",
            "Full classification with grid, gaps, status and points.",
            _schema({"limit": {"type": "integer"}}),
            results,
        ),
        Tool(
            "head_to_head",
            "Explain why one driver finished ahead of another: grid, finish, race pace, fastest "
            "lap and sectors, strategy, and how the gap between them evolved lap by lap.",
            _schema({"driver_a": DRIVER, "driver_b": DRIVER}, ["driver_a", "driver_b"]),
            head_to_head,
        ),
        Tool(
            "lap_comparison",
            "Compare two drivers' fastest laps: sector deltas, where on track time was won, "
            "top speed, throttle and braking. Best for qualifying.",
            _schema({"driver_a": DRIVER, "driver_b": DRIVER}, ["driver_a", "driver_b"]),
            lap_comparison,
        ),
        Tool(
            "strategy",
            "Tyre strategy: for one driver (stints, stops) or the whole field (plans, stop "
            "counts, pit loss, compound degradation). Races only.",
            _schema({"driver": DRIVER}),
            strategy,
        ),
        Tool(
            "race_control",
            "Safety cars, VSCs, red flags, penalties and investigations with laps.",
            _schema(),
            race_control,
        ),
        Tool(
            "pace",
            "Median clean-lap pace ranking — who was actually fastest over the session.",
            _schema(),
            pace,
        ),
        Tool(
            "tyre_degradation",
            "One driver's degradation per stint and whether each stint was too long or short.",
            _schema({"driver": DRIVER}, ["driver"]),
            tyre_degradation,
        ),
        Tool(
            "undercut",
            "Would the attacker have passed the defender by pitting first on this lap? "
            "Simulates undercut and overcut with the fitted tyre model.",
            _schema(
                {"attacker": DRIVER, "defender": DRIVER, "lap": {"type": "integer"}},
                ["attacker", "defender", "lap"],
            ),
            undercut,
        ),
        Tool(
            "weather",
            "Air/track temperature, humidity, wind and rain during the session.",
            _schema(),
            weather,
        ),
        Tool(
            "championship",
            "Driver and constructor standings after this round.",
            _schema(),
            championship,
        ),
    ]
}


def run_tool(ref: SessionRef, name: str, args: dict[str, Any]) -> tuple[str, Result | None]:
    """Run a tool; returns (json for the model, result or None on failure)."""
    tool = TOOLS.get(name)
    if not tool:
        return json.dumps({"error": f"Unknown tool {name}"}), None
    try:
        result = tool.run(ref, **{k: v for k, v in args.items() if v not in (None, "")})
    except DomainError as exc:
        return json.dumps({"error": exc.message, "hint": exc.hint}), None
    except TypeError as exc:
        return json.dumps({"error": f"Bad arguments: {exc}"}), None
    return json.dumps(result[0], default=str, separators=(",", ":")), result
