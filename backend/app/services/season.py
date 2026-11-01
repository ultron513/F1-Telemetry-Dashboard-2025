"""Season-wide analytics read from the Parquet warehouse."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.core.errors import NotFoundError
from app.core.serialize import num
from app.warehouse import store as warehouse


def _known(v: object) -> bool:
    try:
        return v is not None and not np.isnan(float(v))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False


def teammate_battle(season: int) -> dict[str, Any]:
    """Head-to-head between team-mates across every ingested race weekend.

    * Qualifying: classification of the Q session, or the race grid when
      qualifying hasn't been ingested.
    * Race: finishing order when both cars were classified.
    * Pace: median clean-lap gap in each race where both did 10+ clean laps.
    """
    results = warehouse.query(
        "SELECT * FROM results WHERE season = ? AND session IN ('R', 'Q')", [season]
    )
    if results.empty:
        raise NotFoundError(
            f"No {season} sessions have been added to the season warehouse yet.",
            hint="Open some races, or run the warehouse ingest job for this season.",
        )
    laps = warehouse.query(
        """
        SELECT round, code, team, median(lap_time) AS pace, count(*) AS n
        FROM laps
        WHERE season = ? AND session = 'R' AND clean AND lap_time IS NOT NULL
        GROUP BY round, code, team
        """,
        [season],
    )
    pace = {(int(r["round"]), r["code"]): (r["pace"], r["n"]) for _, r in laps.iterrows()}

    races = results[results["session"] == "R"]
    quali = results[results["session"] == "Q"]
    rounds = sorted(int(r) for r in races["round"].unique())
    teams: dict[str, dict[str, Any]] = {}

    for rnd in rounds:
        race = races[races["round"] == rnd]
        q = quali[quali["round"] == rnd]
        for team, group in race.groupby("team"):
            if len(group) != 2:
                continue  # driver change mid-weekend or a missing car
            a, b = sorted(group.to_dict("records"), key=lambda r: r["code"])
            pair_key = f"{a['code']}-{b['code']}"
            t = teams.setdefault(
                str(team),
                {
                    "team": str(team),
                    "team_color": a["team_color"],
                    "pairs": {},
                },
            )
            p = t["pairs"].setdefault(
                pair_key,
                {
                    "drivers": [a["code"], b["code"]],
                    "race": [0, 0],
                    "quali": [0, 0],
                    "points": [0.0, 0.0],
                    "pace_gaps": [],
                    "rounds": [],
                },
            )
            entry: dict[str, Any] = {"round": rnd}
            p["points"][0] += float(a["points"] or 0)
            p["points"][1] += float(b["points"] or 0)
            # Race head-to-head (both classified).
            ca, cb = str(a["classified"] or ""), str(b["classified"] or "")
            if ca.isdigit() and cb.isdigit():
                pos_a, pos_b = int(ca), int(cb)
            elif not ca and not cb and _known(a["position"]) and _known(b["position"]):
                # Official classification not published yet: use the finishing order.
                pos_a, pos_b = int(a["position"]), int(b["position"])
            else:
                pos_a = pos_b = None
            if pos_a is not None and pos_b is not None:
                winner = 0 if pos_a < pos_b else 1
                p["race"][winner] += 1
                entry["race"] = p["drivers"][winner]
            # Qualifying head-to-head.
            qa = q[q["code"] == a["code"]]["position"]
            qb = q[q["code"] == b["code"]]["position"]
            if len(qa) and len(qb) and qa.iloc[0] is not None and qb.iloc[0] is not None:
                pa, pb = int(qa.iloc[0]), int(qb.iloc[0])
                entry["quali_source"] = "qualifying"
            else:
                pa, pb = a["grid"], b["grid"]
                entry["quali_source"] = "grid"
            if _known(pa) and _known(pb):
                winner = 0 if pa < pb else 1
                p["quali"][winner] += 1
                entry["quali"] = p["drivers"][winner]
            # Race pace.
            sa, sb = pace.get((rnd, a["code"])), pace.get((rnd, b["code"]))
            if sa and sb and sa[1] >= 10 and sb[1] >= 10:
                gap = float(sb[0] - sa[0])  # positive: first driver faster
                p["pace_gaps"].append(gap)
                entry["pace_gap"] = num(gap)
            p["rounds"].append(entry)

    out = []
    for t in teams.values():
        for p in t["pairs"].values():
            gaps = p.pop("pace_gaps")
            out.append(
                {
                    "team": t["team"],
                    "team_color": t["team_color"],
                    **p,
                    "points": [num(x, 1) for x in p["points"]],
                    "pace_gap": num(float(np.median(gaps))) if gaps else None,
                    "pace_races": len(gaps),
                    "races": len(p["rounds"]),
                }
            )
    out.sort(key=lambda r: -sum(r["points"]))
    return {"season": season, "rounds": rounds, "pairs": out, "ingested": warehouse.inventory()}
