"""Championship standings and points progression.

Primary source is the Jolpica (Ergast-compatible) API. If it cannot be
reached, standings are rebuilt from whatever race/sprint sessions FastF1
can load, and the response says so via ``source`` / ``rounds_included``.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

import fastf1
import requests

from app.core.config import settings
from app.core.errors import DataUnavailableError
from app.core.memo import memoize
from app.data.schedule import SessionRef, list_events, validate_season

log = logging.getLogger("pitwall.standings")


def _get(path: str, **params: Any) -> dict[str, Any]:
    url = f"{settings.jolpica_base_url}/{path.lstrip('/')}"
    resp = requests.get(url, params=params, timeout=settings.http_timeout)
    resp.raise_for_status()
    return resp.json()["MRData"]


@memoize(maxsize=16, ttl=3600)
def _paged_races(path: str) -> list[dict[str, Any]]:
    races: dict[str, dict[str, Any]] = {}
    offset, limit = 0, 100
    while True:
        data = _get(path, limit=limit, offset=offset)
        for race in data["RaceTable"]["Races"]:
            key = race["round"]
            if key in races:
                for field in ("Results", "SprintResults"):
                    if field in race:
                        races[key].setdefault(field, []).extend(race[field])
            else:
                races[key] = race
        total = int(data.get("total", 0))
        offset += limit
        if offset >= total:
            break
    return sorted(races.values(), key=lambda r: int(r["round"]))


def _from_jolpica(season: int, round_number: int | None) -> dict[str, Any]:
    scope = f"{season}/{round_number}" if round_number else f"{season}"
    d_lists = _get(f"{scope}/driverstandings.json")["StandingsTable"]["StandingsLists"]
    c_lists = _get(f"{scope}/constructorstandings.json")["StandingsTable"]["StandingsLists"]
    if not d_lists:
        raise DataUnavailableError(f"No standings published for {season} yet.")
    d_list = d_lists[0]
    drivers = [
        {
            "position": int(d.get("position") or d.get("positionText", 0) or 0),
            "code": d["Driver"].get("code") or d["Driver"]["familyName"][:3].upper(),
            "driver_id": d["Driver"]["driverId"],
            "number": d["Driver"].get("permanentNumber"),
            "full_name": f"{d['Driver']['givenName']} {d['Driver']['familyName']}",
            "nationality": d["Driver"].get("nationality"),
            "team": d["Constructors"][-1]["name"] if d.get("Constructors") else None,
            "team_id": d["Constructors"][-1]["constructorId"] if d.get("Constructors") else None,
            "points": float(d["points"]),
            "wins": int(d["wins"]),
        }
        for d in d_list["DriverStandings"]
    ]
    constructors = [
        {
            "position": int(c.get("position") or 0),
            "team": c["Constructor"]["name"],
            "team_id": c["Constructor"]["constructorId"],
            "nationality": c["Constructor"].get("nationality"),
            "points": float(c["points"]),
            "wins": int(c["wins"]),
        }
        for c in (c_lists[0]["ConstructorStandings"] if c_lists else [])
    ]
    last_round = int(d_list["round"])

    races = _paged_races(f"{season}/results.json")
    sprints = _paged_races(f"{season}/sprint.json")
    rounds: dict[int, dict[str, Any]] = defaultdict(lambda: {"drivers": {}, "teams": {}})
    names: dict[int, str] = {}
    podiums: dict[str, int] = defaultdict(int)
    poles: dict[str, int] = defaultdict(int)
    for race_list, field in ((races, "Results"), (sprints, "SprintResults")):
        for race in race_list:
            rnd = int(race["round"])
            if rnd > last_round:
                continue
            names[rnd] = race["raceName"]
            for res in race.get(field, []):
                code = res["Driver"].get("code") or res["Driver"]["familyName"][:3].upper()
                team = res["Constructor"]["name"]
                pts = float(res.get("points", 0))
                rounds[rnd]["drivers"][code] = rounds[rnd]["drivers"].get(code, 0) + pts
                rounds[rnd]["teams"][team] = rounds[rnd]["teams"].get(team, 0) + pts
                if field == "Results":
                    if int(res.get("position", 99)) <= 3:
                        podiums[code] += 1
                    if res.get("grid") == "1":
                        poles[code] += 1

    for d in drivers:
        d["podiums"] = podiums.get(d["code"], 0)
        d["poles"] = poles.get(d["code"], 0)

    return {
        "source": "jolpica",
        "round": last_round,
        "drivers": drivers,
        "constructors": constructors,
        "progression": _progression(rounds, names),
        "rounds_included": sorted(rounds),
    }


def _progression(rounds: dict[int, dict[str, Any]], names: dict[int, str]) -> dict[str, Any]:
    ordered = sorted(rounds)
    d_total: dict[str, float] = defaultdict(float)
    t_total: dict[str, float] = defaultdict(float)
    d_series: dict[str, list[float]] = defaultdict(list)
    t_series: dict[str, list[float]] = defaultdict(list)
    all_drivers = {c for r in rounds.values() for c in r["drivers"]}
    all_teams = {t for r in rounds.values() for t in r["teams"]}
    for rnd in ordered:
        for code in all_drivers:
            d_total[code] += rounds[rnd]["drivers"].get(code, 0)
            d_series[code].append(d_total[code])
        for team in all_teams:
            t_total[team] += rounds[rnd]["teams"].get(team, 0)
            t_series[team].append(t_total[team])
    return {
        "rounds": [{"round": r, "name": names.get(r, f"Round {r}")} for r in ordered],
        "drivers": dict(d_series),
        "constructors": dict(t_series),
    }


def _from_fastf1(season: int, round_number: int | None) -> dict[str, Any]:
    """Rebuild standings from sessions FastF1 can load (slow, best effort)."""
    from app.services.results import classification  # local import: avoid cycle

    events = [e for e in list_events(season) if e["status"] == "completed"]
    if round_number:
        events = [e for e in events if e["round"] <= round_number]
    rounds: dict[int, dict[str, Any]] = defaultdict(lambda: {"drivers": {}, "teams": {}})
    names: dict[int, str] = {}
    meta: dict[str, dict[str, Any]] = {}
    wins: dict[str, int] = defaultdict(int)
    team_wins: dict[str, int] = defaultdict(int)
    podiums: dict[str, int] = defaultdict(int)
    for event in events:
        for s in event["sessions"]:
            if s["code"] not in {"R", "S"}:
                continue
            try:
                ses = fastf1.get_session(season, event["round"], s["code"])
                ses.load(laps=True, telemetry=False, weather=False, messages=False)
                rows = classification(SessionRef(season, event["round"], s["code"]), ses)
            except Exception:
                continue
            names[event["round"]] = event["name"]
            for row in rows:
                pts = row["points"] or 0
                rounds[event["round"]]["drivers"][row["code"]] = (
                    rounds[event["round"]]["drivers"].get(row["code"], 0) + pts
                )
                rounds[event["round"]]["teams"][row["team"]] = (
                    rounds[event["round"]]["teams"].get(row["team"], 0) + pts
                )
                meta[row["code"]] = {
                    "full_name": row["full_name"],
                    "team": row["team"],
                    "number": row["number"],
                }
                if s["code"] == "R" and row["position"] == 1:
                    wins[row["code"]] += 1
                    team_wins[row["team"]] += 1
                if s["code"] == "R" and row["position"] and row["position"] <= 3:
                    podiums[row["code"]] += 1
    if not rounds:
        raise DataUnavailableError(
            f"Standings for {season} are unavailable right now.",
            hint="Neither the Jolpica API nor cached timing data could be reached.",
        )
    progression = _progression(rounds, names)
    d_points = {c: s[-1] for c, s in progression["drivers"].items()}
    t_points = {t: s[-1] for t, s in progression["constructors"].items()}
    drivers = [
        {
            "position": i + 1,
            "code": code,
            "driver_id": code.lower(),
            "number": meta[code]["number"],
            "full_name": meta[code]["full_name"],
            "nationality": None,
            "team": meta[code]["team"],
            "team_id": None,
            "points": pts,
            "wins": wins.get(code, 0),
            "podiums": podiums.get(code, 0),
            "poles": 0,
        }
        for i, (code, pts) in enumerate(
            sorted(d_points.items(), key=lambda kv: (-kv[1], -wins.get(kv[0], 0)))
        )
    ]
    constructors = [
        {
            "position": i + 1,
            "team": team,
            "team_id": None,
            "nationality": None,
            "points": pts,
            "wins": team_wins.get(team, 0),
        }
        for i, (team, pts) in enumerate(sorted(t_points.items(), key=lambda kv: -kv[1]))
    ]
    return {
        "source": "fastf1-partial",
        "round": max(rounds),
        "drivers": drivers,
        "constructors": constructors,
        "progression": progression,
        "rounds_included": sorted(rounds),
    }


@memoize(maxsize=32, ttl=1800)
def standings(season: int, round_number: int | None = None) -> dict[str, Any]:
    validate_season(season)
    try:
        data = _from_jolpica(season, round_number)
    except DataUnavailableError:
        raise
    except Exception as exc:
        log.warning("Jolpica unavailable (%s); rebuilding from FastF1", exc)
        data = _from_fastf1(season, round_number)
    data["season"] = season
    return data
