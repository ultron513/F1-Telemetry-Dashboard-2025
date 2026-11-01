"""Ask the pit wall: question answering grounded in the session's data.

Two analysts share the same tools:

* :class:`ModelAnalyst` lets a language model choose and call tools in a loop.
* :class:`RuleAnalyst` recognises the question's intent, calls the tools
  itself and writes the answer from templates. It needs no API key, and it is
  the fallback whenever the model is unavailable.

Both return the same shape: an answer, the charts that back it up, the tools
that were used and suggested follow-up questions.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.ai import facts, llm
from app.ai.tools import TOOLS, Result, run_tool
from app.api import payloads
from app.core.config import settings
from app.data.schedule import SessionRef

log = logging.getLogger("pitwall.ai")

MAX_QUESTION = 500


def _dedupe(charts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen, out = set(), []
    for c in charts:
        key = json.dumps(c, sort_keys=True)
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out[:4]


def _p(pos: Any) -> str:
    return f"P{pos}" if pos else "unclassified"


def _s(value: float | None, digits: int = 3) -> str:
    return "—" if value is None else f"{abs(value):.{digits}f}s"


# --- follow-up suggestions -----------------------------------------------------


def follow_ups(ref: SessionRef, asked: str = "") -> list[str]:
    s = payloads.summary(ref)
    order = [r["code"] for r in s["results"] if r.get("position")]
    out: list[str] = []
    if len(order) >= 2:
        verb = "finish behind" if ref.kind == "race" else "end up slower than"
        out.append(f"Why did {order[1]} {verb} {order[0]}?")
    if ref.kind == "race":
        strat = facts.driver_strategy(ref, order[1]) if len(order) > 1 else None
        stop = strat and strat["stops"] and strat["stops"][0].get("lap")
        if stop and len(order) > 1:
            out.append(f"Could {order[1]} have undercut {order[0]} on lap {max(1, stop - 2)}?")
        out.append("How did the tyre strategies compare?")
        out.append("Were there any safety cars or penalties?")
    else:
        if len(order) >= 2:
            out.append(f"Where did {order[0]} find time over {order[1]}?")
        out.append("Who had the best pace?")
    out.append("What were the conditions like?")
    asked_l = asked.lower().strip("?! .")
    return [q for q in out if q.lower().strip("?! .") != asked_l][:4]


# --- rule-based analyst --------------------------------------------------------


INTENTS: list[tuple[str, re.Pattern[str]]] = [
    ("undercut", re.compile(r"undercut|overcut|pit(ted)? (first|earlier|later)", re.I)),
    ("degradation", re.compile(r"degrad|\bdeg\b|tyre wear|tire wear|stint (too )?long", re.I)),
    (
        "race_control",
        re.compile(
            r"safety car|\bsc\b|\bvsc\b|red flag|penalt|steward|investigat|flag|incident", re.I
        ),
    ),
    ("weather", re.compile(r"weather|rain|wet|temperature|wind|humid|condition", re.I)),
    ("championship", re.compile(r"championship|standings|title|points lead|leader of the", re.I)),
    (
        "strategy",
        re.compile(r"strateg|pit ?stop|\bpit\b|tyre|tire|compound|stint|one.stop|two.stop", re.I),
    ),
    ("pace", re.compile(r"\bpace\b|fastest (car|driver)|quickest|long.run", re.I)),
    (
        "compare",
        re.compile(
            r"\bwhy\b|\bvs\.?\b|versus|compare|beat|lose|lost|ahead|behind|faster than|slower than|gap|difference|where did",
            re.I,
        ),
    ),
    (
        "results",
        re.compile(
            r"\bwho won\b|winner|\bwon\b|podium|result|classification|finish(ed)?|pole", re.I
        ),
    ),
]


class RuleAnalyst:
    mode = "rules"

    def __init__(self, ref: SessionRef):
        self.ref = ref
        self.used: list[dict[str, Any]] = []
        self.charts: list[dict[str, Any]] = []

    def call(self, name: str, **args: Any) -> dict[str, Any] | None:
        _, result = run_tool(self.ref, name, args)
        self.used.append({"name": name, "args": args})
        if result is None:
            return None
        data, charts = result
        self.charts.extend(charts)
        return data

    def intent(self, question: str, drivers: list[str]) -> str:
        for name, pattern in INTENTS:
            if pattern.search(question):
                if name == "compare" and len(drivers) < 2:
                    continue
                if name in {"undercut"} and len(drivers) < 2:
                    continue
                if name == "degradation" and not drivers:
                    continue
                return name
        if len(drivers) >= 2:
            return "compare"
        if len(drivers) == 1:
            return "driver"
        return "overview"

    def answer(self, question: str) -> dict[str, Any]:
        ref = self.ref
        drivers = facts.find_drivers(ref, question)
        intent = self.intent(question, drivers)
        if ref.kind != "race" and intent in {"undercut", "degradation", "strategy"}:
            intent = "compare" if len(drivers) >= 2 else "overview"
        text = getattr(self, f"_{intent}")(question, drivers)
        return {
            "mode": self.mode,
            "intent": intent,
            "answer": text,
            "charts": _dedupe(self.charts),
            "tools": self.used,
            "follow_ups": follow_ups(ref, question),
        }

    # -- intents -------------------------------------------------------------

    def _ordered(self, a: str, b: str) -> tuple[str, str]:
        pos = {r["code"]: r.get("position") or 99 for r in payloads.summary(self.ref)["results"]}
        return (a, b) if pos.get(a, 99) <= pos.get(b, 99) else (b, a)

    def _compare(self, question: str, drivers: list[str]) -> str:
        a, b = self._ordered(drivers[0], drivers[1])
        one_lap = re.search(
            r"fastest lap|one lap|single lap|qualifying lap|\bquali|\bpole\b|\bsector",
            question,
            re.I,
        )
        if self.ref.kind != "race" or one_lap:
            return self._lap_compare(a, b)
        d = self.call("head_to_head", driver_a=a, driver_b=b)
        if not d:
            return f"I couldn't compare {a} and {b} in this session."
        lines = [
            f"**{a} finished {_p(d['finish'][0])}, {b} {_p(d['finish'][1])}.**"
            + (
                f" They started {_p(d['grid'][0])} and {_p(d['grid'][1])}."
                if all(d["grid"])
                else ""
            )
        ]
        reasons: list[tuple[float, str]] = []

        if d.get("median_pace_delta_s") is not None:
            delta = d["median_pace_delta_s"]
            quicker = a if delta > 0 else b
            weight = abs(delta) * 10
            lines.append(
                f"- **Race pace:** {quicker}'s median clean lap was {_s(delta)} quicker "
                f"({a} {d['median_pace'][0]}, {b} {d['median_pace'][1]})."
            )
            if quicker == b:
                lines[-1] += f" {b} had the pace but couldn't turn it into the place."
            if quicker == a:
                reasons.append((weight, f"{a} simply had more race pace"))
        if d.get("fastest_lap_delta_s") is not None:
            delta = d["fastest_lap_delta_s"]
            quicker = a if delta > 0 else b
            sectors = d.get("sectors_delta_s", {})
            # sector deltas: positive means A quicker in that sector
            best = max(sectors.items(), key=lambda kv: abs(kv[1] or 0), default=None)
            sector_txt = ""
            if best and best[1]:
                sector_txt = f", mostly in {best[0]} ({a if best[1] > 0 else b} +{_s(best[1])})"
            lines.append(
                f"- **Fastest lap:** {quicker} was {_s(delta)} quicker over one lap{sector_txt}; "
                f"mini-sectors {d['minisectors_won'][0]}–{d['minisectors_won'][1]}."
            )
        strat = d.get("strategy") or {}
        sa, sb = strat.get(a) or {}, strat.get(b) or {}
        if sa and sb:
            plan = lambda s: "→".join(x["compound"].title() for x in s["stints"]) or "—"  # noqa: E731
            stops = lambda s: ", ".join(f"L{x['lap']}" for x in s["stops"]) or "no stops"  # noqa: E731
            lines.append(
                f"- **Strategy:** {a} {plan(sa)} (stopped {stops(sa)}); "
                f"{b} {plan(sb)} (stopped {stops(sb)})."
            )
            lane_a = [x["pit_lane_s"] for x in sa["stops"] if x.get("pit_lane_s")]
            lane_b = [x["pit_lane_s"] for x in sb["stops"] if x.get("pit_lane_s")]
            if lane_a and lane_b and abs(sum(lane_a) - sum(lane_b)) >= 0.8:
                diff = sum(lane_b) - sum(lane_a)
                faster = a if diff > 0 else b
                lines.append(f"- **Pit lane:** {faster} spent {_s(diff, 1)} less in the pit lane.")
                if faster == a:
                    reasons.append((abs(diff), f"{a} lost less time in the pits"))
            stops_a = {x["lap"] for x in sa["stops"]}
            stops_b = {x["lap"] for x in sb["stops"]}
            if stops_a != stops_b and stops_a and stops_b:
                reasons.append((1.0, "the stops came on different laps, which shuffled the order"))
        gap = d.get("gap_b_behind_a")
        if gap:
            swings = d.get("biggest_gap_swings") or []
            swing_txt = ", ".join(
                f"L{s['lap']} ({'+' if s['change_s'] > 0 else '−'}{abs(s['change_s']):.1f}s)"
                for s in swings[:3]
            )
            swaps = gap.get("order_swaps_on_laps") or []
            lines.append(
                f"- **The gap:** {b} was {_s(gap['first_lap'], 1)} "
                f"{'behind' if gap['first_lap'] > 0 else 'ahead'} after lap 1 and "
                f"{_s(gap['final'], 1)} {'behind' if gap['final'] > 0 else 'ahead'} at the flag"
                + (f"; they swapped places on lap {', '.join(map(str, swaps))}" if swaps else "")
                + (f". Biggest swings (+ means {b} lost time): {swing_txt}." if swing_txt else ".")
            )
            if not swaps and gap["first_lap"] > 0:
                reasons.append((0.8, f"{a} was ahead from the opening lap and track position held"))
        if all(d["grid"]) and d["grid"][0] < d["grid"][1]:
            reasons.append((0.6, f"{a} started ahead"))

        if reasons:
            reasons.sort(reverse=True)
            lines.append(
                f"\n**Verdict:** mainly because {reasons[0][1]}"
                + (f", and {reasons[1][1]}." if len(reasons) > 1 else ".")
            )
        return "\n".join(lines)

    def _lap_compare(self, a: str, b: str) -> str:
        d = self.call("lap_comparison", driver_a=a, driver_b=b)
        if not d:
            return f"I couldn't compare {a}'s and {b}'s laps."
        delta = d["delta_s"] or 0
        quicker = a if delta > 0 else b
        lines = [
            f"**{quicker} was {_s(delta)} quicker** "
            f"({d['lap_times'][a]} vs {d['lap_times'][b]} for {a} and {b})."
        ]
        sectors = ", ".join(
            f"{k} {a if (v or 0) > 0 else b} +{_s(v)}"
            for k, v in d["sectors_delta_s"].items()
            if v is not None
        )
        if sectors:
            lines.append(f"- **Sectors:** {sectors}.")
        lines.append(
            f"- **Mini-sectors:** {a} won {d['minisectors_won'][a]}, {b} won {d['minisectors_won'][b]}."
        )
        if d["biggest_minisector_gaps"]:
            spots = "; ".join(
                f"{g['faster']} +{g['gain_s']:.3f}s at {g['from_m']:.0f}–{g['to_m']:.0f} m"
                for g in d["biggest_minisector_gaps"][:3]
            )
            lines.append(f"- **Where the time was:** {spots}.")
        sa, sb = d["stats"][a], d["stats"][b]
        if sa.get("max_speed") and sb.get("max_speed"):
            lines.append(
                f"- **Top speed:** {a} {sa['max_speed']:.0f} km/h, {b} {sb['max_speed']:.0f} km/h; "
                f"full throttle {sa.get('full_throttle_pct') or 0:.0f}% vs {sb.get('full_throttle_pct') or 0:.0f}%."
            )
        return "\n".join(lines)

    def _results(self, question: str, drivers: list[str]) -> str:
        d = self.call("session_overview")
        if not d:
            return "No results are available for this session."
        top = d["top10"]
        if self.ref.kind == "race":
            head = f"**{d['winner_or_fastest']} won the {d['event']}**"
            if len(top) > 1 and top[1]["gap_s"]:
                head += f" by {_s(top[1]['gap_s'], 1)} from {top[1]['driver']}"
            head += f", with {top[2]['driver']} third." if len(top) > 2 else "."
        else:
            head = f"**{top[0]['driver']} was fastest in {self.ref.name}**"
            if len(top) > 1:
                head += (
                    f", ahead of {top[1]['driver']} and {top[2]['driver'] if len(top) > 2 else ''}".rstrip(
                        " ,"
                    )
                    + "."
                )
        rows = "\n".join(
            f"{r['pos']}. {r['driver']} ({r['team']})"
            + (
                f" — {r['status']}"
                if r["status"]
                and r["status"] not in {"Finished"}
                and not str(r["status"]).startswith("+")
                else ""
            )
            for r in top[:10]
        )
        extra = []
        if d.get("fastest_lap"):
            fl = d["fastest_lap"]
            extra.append(
                f"Fastest lap: {fl['driver']} {fl['time']}"
                + (f" on lap {fl['lap']}." if fl.get("lap") else ".")
            )
        if d.get("lead_changes"):
            extra.append(
                "Lead changes: "
                + ", ".join(f"L{c['lap']} {c['from']}→{c['to']}" for c in d["lead_changes"])
                + "."
            )
        return "\n".join([head, "", rows, "", *extra]).strip()

    def _overview(self, question: str, drivers: list[str]) -> str:
        return self._results(question, drivers)

    def _driver(self, question: str, drivers: list[str]) -> str:
        code = drivers[0]
        row = next((r for r in payloads.summary(self.ref)["results"] if r["code"] == code), None)
        info = facts.require_driver(self.ref, code)
        lines = [
            f"**{info['full_name']} ({info['team']})** — {_p(row and row.get('position'))}"
            + (f" from {_p(row.get('grid'))} on the grid" if row and row.get("grid") else "")
            + (
                f", {row['status']}"
                if row and row.get("status") and row["status"] != "Finished"
                else ""
            )
            + "."
        ]
        if row and row.get("best_lap"):
            lines.append(
                f"- Best lap {facts.fmt_time(row['best_lap'])}"
                + (f" (lap {row['best_lap_number']})" if row.get("best_lap_number") else "")
                + "."
            )
        if self.ref.kind == "race":
            d = self.call("strategy", driver=code)
            if d and d.get("stints"):
                lines.append(
                    "- Strategy: "
                    + " → ".join(f"{s['compound'].title()} L{s['laps']}" for s in d["stints"])
                    + "."
                )
        pace = facts.pace_ranking(self.ref, 25)
        rank = next((i + 1 for i, p in enumerate(pace) if p["driver"] == code), None)
        if rank:
            lines.append(
                f"- Ranked {rank} on median lap pace ({pace[rank - 1]['median']}, +{pace[rank - 1]['gap_s'] or 0:.3f}s to the best)."
            )
        return "\n".join(lines)

    def _strategy(self, question: str, drivers: list[str]) -> str:
        if drivers:
            d = self.call("strategy", driver=drivers[0])
            if not d or not d.get("stints"):
                return f"No strategy data for {drivers[0]}."
            stints = "\n".join(
                f"- {s['compound'].title()}, laps {s['laps']} ({s['length']} laps"
                + (f", avg {facts.fmt_time(s['avg'])}" if s.get("avg") else "")
                + (
                    f", {s['deg_s_per_lap']:+.3f}s/lap"
                    if s.get("deg_s_per_lap") is not None
                    else ""
                )
                + ")"
                for s in d["stints"]
            )
            stops = ", ".join(
                f"lap {x['lap']}"
                + (
                    f" ({x['pit_lane_s']}s in the lane"
                    + (f", under {x['under']}" if x.get("under") else "")
                    + ")"
                    if x.get("pit_lane_s")
                    else ""
                )
                for x in d["stops"]
            )
            return (
                f"**{drivers[0]}: {len(d['stops'])}-stop.**\n{stints}\n\nStops: {stops or 'none'}."
            )
        d = self.call("strategy")
        if not d:
            return "No strategy data for this session."
        counts = ", ".join(f"{v}× {k}" for k, v in d["stops_count"].items())
        plans = ", ".join(f"{p['driver']} {p['plan']}" for p in d["plans_top"][:6])
        deg = ", ".join(
            f"{k.title()} {v:+.3f}s/lap"
            for k, v in d["compound_deg_s_per_lap"].items()
            if v is not None
        )
        lines = [f"**Strategies:** {counts}.", f"- Top six: {plans} (S/M/H = Soft/Medium/Hard)."]
        if deg:
            lines.append(f"- Fuel-corrected degradation: {deg}.")
        if d.get("pit_loss_s"):
            lines.append(f"- A stop cost about {d['pit_loss_s']}s.")
        if d.get("fastest_pit_lane"):
            f = d["fastest_pit_lane"]
            lines.append(f"- Fastest pit lane time: {f['driver']} {f['s']}s on lap {f['lap']}.")
        return "\n".join(lines)

    def _race_control(self, question: str, drivers: list[str]) -> str:
        d = self.call("race_control")
        if not d:
            return "No race control data for this session."
        lines = []
        if d["track_events"]:
            lines.append(
                "**Neutralisations:** "
                + "; ".join(
                    f"{e['kind']} laps {e['start_lap']}–{e['end_lap']}" for e in d["track_events"]
                )
                + "."
            )
        else:
            lines.append("**No safety cars, VSCs or red flags.**")
        if d["penalties"]:
            lines.append(
                "**Penalties:**\n"
                + "\n".join(f"- L{p['lap'] or '?'}: {p['message']}" for p in d["penalties"][:6])
            )
        else:
            lines.append("No penalties were handed out.")
        if d["investigations"]:
            lines.append(f"{len(d['investigations'])} incidents were noted or investigated.")
        return "\n".join(lines)

    def _weather(self, question: str, drivers: list[str]) -> str:
        d = self.call("weather")
        if not d or "air_c" not in d:
            return "No weather data for this session."
        rain = (
            "It stayed dry."
            if not d.get("rain_share")
            else f"Rain fell for about {d['rain_share'] * 100:.0f}% of the session."
        )
        return (
            f"**Air {d['air_c'][0]}–{d['air_c'][1]} °C, track {d['track_c'][0]}–{d['track_c'][1]} °C.** "
            f"Humidity around {d['humidity_pct']:.0f}%, wind {d['wind_ms']} m/s. {rain}"
        )

    def _pace(self, question: str, drivers: list[str]) -> str:
        d = self.call("pace")
        rows = (d or {}).get("median_lap_pace") or []
        if not rows:
            return "No pace data for this session."
        lines = [f"**{rows[0]['driver']} had the best median pace ({rows[0]['median']}).**"]
        lines += [
            f"{i + 1}. {r['driver']} {r['median']} (+{r['gap_s'] or 0:.3f}s)"
            for i, r in enumerate(rows[:8])
        ]
        return "\n".join(lines)

    def _degradation(self, question: str, drivers: list[str]) -> str:
        d = self.call("tyre_degradation", driver=drivers[0])
        if not d:
            return f"No degradation data for {drivers[0]}."
        lines = [f"**{d['driver']}: {d['risk']} risk, pit loss {d['pit_loss_s']}s.**"]
        for s in d["stints"]:
            lines.append(
                f"- {s['compound'].title()} ({s['laps']} laps): "
                + (
                    f"{s['deg_s_per_lap']:+.3f}s/lap, "
                    if s.get("deg_s_per_lap") is not None
                    else ""
                )
                + (
                    f"optimal ≈ {s['optimal_length']:.0f} laps — "
                    if s.get("optimal_length")
                    else ""
                )
                + s["verdict"]
            )
        return "\n".join(lines)

    def _undercut(self, question: str, drivers: list[str]) -> str:
        m = re.search(r"lap\s*(\d+)", question, re.I)
        attacker, defender = drivers[0], drivers[1]
        lap = int(m.group(1)) if m else None
        if lap is None:
            strat = facts.driver_strategy(self.ref, defender) or {}
            stop = (strat.get("stops") or [{}])[0].get("lap")
            lap = max(1, (stop or 10) - 2)
        d = self.call("undercut", attacker=attacker, defender=defender, lap=lap)
        if not d:
            return f"I couldn't simulate {attacker} attacking {defender} on lap {lap}."
        u, o = d["undercut"], d["overcut"]
        return (
            f"**{d['verdict']}**\n"
            f"- On lap {d['lap']} {attacker} was {_s(d['gap_s'], 1)} behind {defender}; "
            f"fresh tyres were worth about {_s(d['fresh_tyre_gain_s_per_lap'], 2)} per lap and a stop cost {d['pit_loss_s']}s.\n"
            f"- **Undercut** (pit first): {attacker} {'comes out ahead' if u['attacker_ahead'] else 'stays behind'}"
            f" (final gap {_s(u['final_gap_s'], 1)}).\n"
            f"- **Overcut** (stay out): {attacker} {'comes out ahead' if o['attacker_ahead'] else 'stays behind'}"
            f" (final gap {_s(o['final_gap_s'], 1)})."
        )

    def _championship(self, question: str, drivers: list[str]) -> str:
        d = self.call("championship")
        if not d or not d.get("drivers"):
            return "Championship standings aren't available right now."
        lead = d["drivers"][0]
        lines = [
            f"**After round {d['after_round']}, {lead['driver']} leads on {lead['points']:.0f} points.**"
        ]
        lines += [f"{x['pos']}. {x['driver']} {x['points']:.0f}" for x in d["drivers"][:6]]
        if d.get("constructors"):
            c = d["constructors"][0]
            lines.append(f"\nConstructors: {c['team']} lead on {c['points']:.0f}.")
        return "\n".join(lines)


# --- model analyst -------------------------------------------------------------


def system_prompt(ref: SessionRef) -> str:
    s = payloads.summary(ref)
    roster = ", ".join(f"{d['code']}={d['full_name']} ({d['team']})" for d in s["drivers"])
    return (
        "You are the race strategist on an F1 pit wall, answering questions about one session "
        f"in the Pit Wall dashboard: {s['event']['name']} {ref.season}, {ref.name}.\n"
        f"Drivers: {roster}.\n\n"
        "Rules:\n"
        "- Use the tools to get data before stating any number; never invent figures. If the "
        "data doesn't answer the question, say so plainly.\n"
        "- Cite laps and seconds. Gaps and deltas from tools follow the sign convention they "
        "state; read them carefully.\n"
        "- Be concise: a one-line bold answer, then up to five short bullets, under 180 words. "
        "Use **bold** and '- ' bullets only, no headings or tables.\n"
        "- Use three-letter driver codes after first mention.\n"
        "- The data is public timing, position and car telemetry. Team-only data (tyre "
        "temperatures, fuel loads, setup) isn't available; don't speculate about it as fact."
    )


class ModelAnalyst:
    mode = "llm"

    def __init__(self, ref: SessionRef):
        self.ref = ref

    def answer(self, question: str, history: list[dict[str, str]]) -> dict[str, Any]:
        convo = llm.Conversation(system_prompt(self.ref), [t.spec() for t in TOOLS.values()])
        for turn in history[-6:]:
            if turn.get("role") == "user":
                convo.user(turn["content"][:MAX_QUESTION])
            elif turn.get("role") == "assistant":
                convo.assistant_text(turn["content"][:2000])
        convo.user(question)
        charts: list[dict[str, Any]] = []
        used: list[dict[str, Any]] = []
        reply = None
        for step in range(settings.llm_max_steps):
            reply = convo.step(allow_tools=step < settings.llm_max_steps - 1)
            if not reply.tool_calls:
                break
            results: list[tuple[llm.ToolCall, str]] = []
            for call in reply.tool_calls:
                content, result = run_tool(self.ref, call.name, call.args)
                used.append({"name": call.name, "args": call.args})
                if result:
                    charts.extend(result[1])
                results.append((call, content[:12000]))
            convo.tool_results(results)
        text = reply.text if reply else ""
        if not text:
            raise llm.LLMError("The language model returned no answer.")
        return {
            "mode": self.mode,
            "intent": None,
            "answer": text,
            "charts": _dedupe(charts),
            "tools": used,
            "follow_ups": follow_ups(self.ref, question),
            "model": llm.describe()["model"],
        }


def ask(
    ref: SessionRef, question: str, history: list[dict[str, str]] | None = None
) -> dict[str, Any]:
    question = " ".join(question.split())[:MAX_QUESTION]
    if llm.configured():
        try:
            return ModelAnalyst(ref).answer(question, history or [])
        except llm.LLMError as exc:
            log.warning("Falling back to the rule-based analyst: %s", exc)
            out = RuleAnalyst(ref).answer(question)
            out["notice"] = "The language model was unavailable, so the built-in analyst answered."
            return out
    return RuleAnalyst(ref).answer(question)


__all__ = ["ask", "follow_ups", "RuleAnalyst", "ModelAnalyst", "Result"]
