"""Automatic session reports.

The report is always assembled from data first (template mode), so it works
offline and every figure is traceable. When a language model is configured
it may rewrite the prose — but only from the same facts, and the template
version is kept if anything goes wrong.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.ai import facts, llm
from app.api import payloads
from app.core.memo import memoize
from app.data.schedule import SessionRef

log = logging.getLogger("pitwall.ai")


def _ctx(ref: SessionRef) -> dict[str, Any]:
    return {
        "season": ref.season,
        "round": ref.round,
        "session": {"code": ref.code, "name": ref.name, "kind": ref.kind},
    }


def _join(items: list[str]) -> str:
    items = [i for i in items if i]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _name(drivers: dict[str, dict[str, Any]], code: str | None) -> str:
    d = drivers.get(code or "")
    return d["full_name"] if d else (code or "—")


def _plan(stints: list[dict[str, Any]]) -> str:
    return "–".join(s["compound"].title() for s in stints)


# --- template report ----------------------------------------------------------


def _race(ref: SessionRef, s: dict[str, Any]) -> dict[str, Any]:
    drivers = {d["code"]: d for d in s["drivers"]}
    h = s["highlights"]
    res = [r for r in s["results"] if r.get("position")]
    event = s["event"]["name"]
    winner = res[0]["code"] if res else h.get("winner")
    second = res[1] if len(res) > 1 else None
    margin = second and second.get("gap")

    leads = facts.lead_changes(ref)
    neutral = facts.track_events(ref)
    pens = facts.stewards(ref)
    moves = facts.movers(ref)
    strat = facts.strategy_overview(ref)
    pace = facts.pace_ranking(ref, 5)
    wx = facts.weather_brief(ref)

    headline = f"{_name(drivers, winner)} wins the {event}"
    if margin is not None and margin < 2.0:
        headline = f"{_name(drivers, winner)} holds on by {margin:.3f}s in the {event}"
    elif margin is not None and margin > 15:
        headline = f"{_name(drivers, winner)} dominates the {event}"
    if leads and len({c["to"] for c in leads}) > 1:
        headline += " after a battle for the lead"

    podium = [r["code"] for r in res[:3]]
    standfirst = (
        (
            f"{_name(drivers, podium[0])} ({drivers[podium[0]]['team']}) won from "
            + _join([f"{_name(drivers, c)}" for c in podium[1:]])
            + (f", {margin:.3f}s ahead at the flag." if margin is not None else ".")
        )
        if podium
        else f"The {event} results."
    )

    moments: list[dict[str, Any]] = []
    for c in leads:
        moments.append(
            {"lap": c["lap"], "kind": "lead", "text": f"{c['to']} takes the lead from {c['from']}"}
        )
    for e in neutral:
        moments.append(
            {
                "lap": e["start_lap"],
                "kind": "neutral",
                "text": f"{e['kind']}" + (f" until lap {e['end_lap']}" if e.get("end_lap") else ""),
            }
        )
    for p in pens[:5]:
        moments.append({"lap": p["lap"], "kind": "penalty", "text": p["message"].capitalize()})
    fl = h.get("fastest_lap")
    if fl and fl.get("lap"):
        moments.append(
            {
                "lap": fl["lap"],
                "kind": "fastest",
                "text": f"Fastest lap: {fl['driver']} {facts.fmt_time(fl.get('time'))}",
            }
        )
    for r in h.get("retirements") or []:
        moments.append({"lap": None, "kind": "retirement", "text": f"{r} retires"})
    moments.sort(key=lambda m: (m["lap"] is None, m["lap"] or 0))

    sections: list[dict[str, str]] = []
    # How it unfolded
    unfolded: list[str] = []
    if leads:
        unfolded.append(
            "The lead changed hands "
            + ("once" if len(leads) == 1 else f"{len(leads)} times")
            + ": "
            + "; ".join(f"{c['to']} on lap {c['lap']}" for c in leads)
            + ". Most lead changes come from the pit-stop cycle rather than on-track passes."
        )
    else:
        unfolded.append(f"{winner} led every lap they completed at the front.")
    if neutral:
        unfolded.append(
            "The race was neutralised by "
            + _join(
                [f"a {e['kind'].lower()} (laps {e['start_lap']}–{e['end_lap']})" for e in neutral]
            )
            + "."
        )
    else:
        unfolded.append("There were no safety cars, VSCs or red flags.")
    if moves["gainers"]:
        g = moves["gainers"][0]
        unfolded.append(f"Biggest climber: {g['driver']}, P{g['grid']} to P{g['finish']}.")
    if h.get("retirements"):
        unfolded.append(f"Retirements: {_join(h['retirements'])}.")
    sections.append({"title": "How it unfolded", "body": " ".join(unfolded)})

    if strat:
        counts = strat["stops_count"]
        common_n = max(counts, key=counts.get) if counts else None
        plans = [p["plan"] for p in strat["plans_top"][:5]]
        top_plan = max(set(plans), key=plans.count) if plans else None
        body = []
        if common_n:
            body.append(
                f"Most drivers ran a {common_n} race ({counts[common_n]} of {sum(counts.values())})."
            )
        if top_plan:
            body.append(f"The typical plan at the front was {top_plan.replace('-', '→')} (S/M/H).")
        if strat.get("pit_loss_s"):
            body.append(f"A stop cost about {strat['pit_loss_s']}s.")
        deg = {k: v for k, v in strat["compound_deg_s_per_lap"].items() if v is not None}
        if deg:
            worst = max(deg, key=deg.get)
            body.append(
                f"The {worst.lower()} tyre degraded most ({deg[worst]:+.3f}s per lap, fuel-corrected)."
            )
        f = strat.get("fastest_pit_lane")
        if f:
            body.append(f"Quickest pit lane time: {f['driver']}, {f['s']}s on lap {f['lap']}.")
        sections.append({"title": "Strategy", "body": " ".join(body)})

    if pace:
        best = pace[0]
        body = f"On median clean-lap pace {best['driver']} was quickest ({best['median']})"
        if len(pace) > 1:
            body += f", {pace[1]['driver']} {pace[1]['gap_s']:.3f}s back"
        body += "."
        if winner and best["driver"] != winner:
            body += f" The winner, {winner}, wasn't the fastest car — track position and strategy decided it."
        sections.append({"title": "Pace", "body": body})

    if pens:
        sections.append(
            {
                "title": "Stewards",
                "body": " ".join(
                    f"Lap {p['lap'] or '?'}: {p['message'].capitalize()}." for p in pens[:4]
                ),
            }
        )

    if wx:
        rain = (
            "dry throughout"
            if not wx.get("rain_share")
            else f"rain for about {wx['rain_share'] * 100:.0f}% of the race"
        )
        sections.append(
            {
                "title": "Conditions",
                "body": f"Air {wx['air_c'][0]}–{wx['air_c'][1]} °C, track {wx['track_c'][0]}–{wx['track_c'][1]} °C, {rain}.",
            }
        )

    stats = [
        {"label": "Winning margin", "value": f"{margin:.3f}s" if margin is not None else "—"},
        {"label": "Lead changes", "value": str(len(leads))},
        {"label": "Pit stops", "value": str(h.get("pit_stops") or 0)},
        {"label": "Safety cars", "value": str((h.get("safety_car") or 0) + (h.get("vsc") or 0))},
    ]
    return {
        "headline": headline,
        "standfirst": standfirst,
        "sections": sections,
        "moments": moments,
        "stats": stats,
    }


def _timed(ref: SessionRef, s: dict[str, Any]) -> dict[str, Any]:
    drivers = {d["code"]: d for d in s["drivers"]}
    res = [
        r for r in s["results"] if r.get("best_lap") or r.get("q3") or r.get("q2") or r.get("q1")
    ]
    event = s["event"]["name"]
    if not res:
        return {
            "headline": f"{event} — {ref.name}",
            "standfirst": "No timed laps.",
            "sections": [],
            "moments": [],
            "stats": [],
        }

    def best(r: dict[str, Any]) -> float | None:
        return r.get("q3") or r.get("q2") or r.get("q1") or r.get("best_lap")

    top = res[0]
    t0 = best(top)
    gap2 = best(res[1]) - t0 if len(res) > 1 and best(res[1]) and t0 else None
    is_quali = ref.kind == "qualifying"
    verb = "takes pole" if is_quali else "tops"
    headline = f"{_name(drivers, top['code'])} {verb} " + (
        f"for the {event}" if is_quali else f"{ref.name} at the {event}"
    )
    standfirst = (
        f"{_name(drivers, top['code'])} ({top['team']}) set {facts.fmt_time(t0)}"
        + (f", {gap2:.3f}s clear of {res[1]['code']}" if gap2 is not None else "")
        + (f", with {res[2]['code']} third." if len(res) > 2 else ".")
    )
    sections = []
    spread = [f"{r['code']} +{best(r) - t0:.3f}s" for r in res[1:6] if best(r) and t0]
    if spread:
        sections.append(
            {"title": "The order", "body": "Behind the top: " + ", ".join(spread) + "."}
        )
    if len(res) > 1:
        cmp = facts.safe(payloads.compare, ref, top["code"], "fastest", res[1]["code"], "fastest")
        if cmp:
            secs = ", ".join(
                f"{x['sector']} {top['code'] if (x['delta'] or 0) > 0 else res[1]['code']} +{abs(x['delta'] or 0):.3f}s"
                for x in cmp["sectors"]
                if x["delta"] is not None
            )
            sections.append(
                {
                    "title": f"{top['code']} vs {res[1]['code']}",
                    "body": f"Sector by sector: {secs}. Mini-sectors {cmp['dominance']['a']}–{cmp['dominance']['b']}; "
                    f"top speed {cmp['a']['stats'].get('max_speed') or 0:.0f} vs {cmp['b']['stats'].get('max_speed') or 0:.0f} km/h.",
                }
            )
    teams: dict[str, list[dict[str, Any]]] = {}
    for r in res:
        teams.setdefault(r["team"], []).append(r)
    battles = []
    for team, rows in teams.items():
        if len(rows) == 2 and best(rows[0]) and best(rows[1]):
            battles.append(
                (abs(best(rows[1]) - best(rows[0])), team, rows[0]["code"], rows[1]["code"])
            )
    if battles:
        battles.sort()
        closest = battles[0]
        sections.append(
            {
                "title": "Team-mates",
                "body": f"Closest intra-team gap: {closest[2]} ahead of {closest[3]} by {closest[0]:.3f}s ({closest[1]}). "
                f"Largest: {battles[-1][2]} over {battles[-1][3]} by {battles[-1][0]:.3f}s ({battles[-1][1]}).",
            }
        )
    wx = facts.weather_brief(ref)
    if wx:
        sections.append(
            {
                "title": "Conditions",
                "body": f"Track {wx['track_c'][0]}–{wx['track_c'][1]} °C, air {wx['air_c'][0]}–{wx['air_c'][1]} °C.",
            }
        )
    stats = [
        {"label": "Best time", "value": facts.fmt_time(t0)},
        {"label": "Gap to P2", "value": f"{gap2:.3f}s" if gap2 is not None else "—"},
        {"label": "Drivers", "value": str(len(res))},
    ]
    return {
        "headline": headline,
        "standfirst": standfirst,
        "sections": sections,
        "moments": [],
        "stats": stats,
    }


@memoize(256, 6 * 3600)
def template_report(ref: SessionRef) -> dict[str, Any]:
    s = payloads.summary(ref)
    body = _race(ref, s) if ref.kind == "race" else _timed(ref, s)
    return {**_ctx(ref), "event": s["event"]["name"], "mode": "template", "model": None, **body}


# --- optional model rewrite ----------------------------------------------------


@memoize(256, 6 * 3600)
def narrated_report(ref: SessionRef) -> dict[str, Any]:
    base = template_report(ref)
    if not llm.configured():
        return base
    prompt = (
        "Rewrite this Formula 1 session report as a sharp, engaging journalist would. Use ONLY "
        "facts present in the JSON; do not add any number, name or event that isn't there. Keep "
        "it concise. Return JSON only, shaped exactly "
        '{"headline": str, "standfirst": str, "sections": [{"title": str, "body": str}]} '
        "with at most 5 sections of 1–3 sentences.\n\n"
        + json.dumps(
            {
                k: base[k]
                for k in ("event", "headline", "standfirst", "sections", "moments", "stats")
            }
        )
    )
    try:
        convo = llm.Conversation(
            "You are a precise F1 journalist. Output JSON only.", [], max_tokens=1200
        )
        convo.user(prompt)
        text = convo.step(allow_tools=False).text
        match = re.search(r"\{.*\}", text, re.S)
        data = json.loads(match.group(0) if match else text)
        sections = [
            {"title": str(x["title"])[:80], "body": str(x["body"])[:900]}
            for x in data.get("sections", [])[:5]
            if x.get("title") and x.get("body")
        ]
        if not data.get("headline") or not sections:
            raise ValueError("incomplete report")
        return {
            **base,
            "headline": str(data["headline"])[:160],
            "standfirst": str(data.get("standfirst") or base["standfirst"])[:400],
            "sections": sections,
            "mode": "llm",
            "model": llm.describe()["model"],
        }
    except (llm.LLMError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        log.warning("Report narration failed, using the template: %s", exc)
        return base


def report(ref: SessionRef, narrate: bool = True) -> dict[str, Any]:
    return narrated_report(ref) if narrate else template_report(ref)
