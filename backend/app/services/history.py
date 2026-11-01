"""Formula 1 history back to 1950, from the Jolpica (Ergast-compatible) API.

Responses are cached on disk: finished seasons never change, so anything
about them is kept forever; the current season refreshes every few hours.
Large collections are paged transparently.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

from app.core.config import settings
from app.core.errors import DataUnavailableError, InvalidParameterError, NotFoundError

log = logging.getLogger("pitwall.history")

PAGE = 100
LIVE_TTL = 6 * 3600
MIN_INTERVAL = 0.3  # be polite to the community-run API (~4 req/s burst limit)


class JolpicaClient:
    def __init__(
        self,
        base_url: str | None = None,
        cache_dir: Path | None = None,
        offline: bool | None = None,
    ):
        self.base_url = (base_url or settings.jolpica_base_url).rstrip("/")
        self.cache_dir = cache_dir or settings.history_cache_dir
        self.offline = settings.offline if offline is None else offline
        self._lock = threading.Lock()
        self._last = 0.0

    def _cache_path(self, path: str, params: dict[str, Any]) -> Path:
        key = json.dumps([path, sorted(params.items())])
        return self.cache_dir / f"{hashlib.sha1(key.encode()).hexdigest()}.json"

    def get(self, path: str, *, permanent: bool = False, **params: Any) -> dict[str, Any]:
        """One page of ``path`` (``.json`` added), cached on disk."""
        target = self._cache_path(path, params)
        if target.exists():
            age = time.time() - target.stat().st_mtime
            if permanent or age < LIVE_TTL or self.offline:
                return json.loads(target.read_text())
        if self.offline:
            raise DataUnavailableError(
                "This history isn't cached and the app is in offline mode.",
                hint="Turn off F1_OFFLINE to fetch it from the Jolpica API.",
            )
        with self._lock:
            wait = MIN_INTERVAL - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            try:
                resp = requests.get(
                    f"{self.base_url}/{path}.json", params=params, timeout=settings.http_timeout
                )
            except requests.RequestException as exc:
                if target.exists():
                    return json.loads(target.read_text())
                raise DataUnavailableError(
                    "The F1 history service (Jolpica) can't be reached.", hint="Try again shortly."
                ) from exc
            finally:
                self._last = time.monotonic()
        if resp.status_code == 429:
            raise DataUnavailableError(
                "The F1 history service is rate-limiting requests.", hint="Wait a minute and retry."
            )
        if resp.status_code >= 400:
            raise DataUnavailableError(f"The F1 history service returned {resp.status_code}.")
        data = resp.json()
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps(data))
        tmp.replace(target)
        return data

    def all(
        self, path: str, table: str, rows: str, *, permanent: bool = False
    ) -> list[dict[str, Any]]:
        """Every row of a paged collection, e.g. ``all("drivers", "DriverTable", "Drivers")``."""
        out: list[dict[str, Any]] = []
        offset = 0
        while True:
            data = self.get(path, permanent=permanent, limit=PAGE, offset=offset)["MRData"]
            items = data.get(table, {}).get(rows, [])
            out.extend(items)
            total = int(data.get("total", 0))
            offset += PAGE
            if offset >= total or not items:
                return out


_client = JolpicaClient()


def client() -> JolpicaClient:
    return _client


def set_client(c: JolpicaClient) -> None:
    """Swap the client (tests)."""
    global _client
    _client = c


def _year() -> int:
    return datetime.now(UTC).year


def _merge_races(races: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    """Paged race tables can split one race's rows across pages; merge them."""
    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for race in races:
        k = (race["season"], race["round"])
        if k in merged:
            merged[k][key].extend(race.get(key, []))
        else:
            merged[k] = {**race, key: list(race.get(key, []))}
    return sorted(merged.values(), key=lambda r: (int(r["season"]), int(r["round"])))


def _driver_name(d: dict[str, Any]) -> str:
    return f"{d.get('givenName', '')} {d.get('familyName', '')}".strip()


def _lap_seconds(text: str | None) -> float | None:
    if not text:
        return None
    try:
        if ":" in text:
            m, s = text.split(":")
            return int(m) * 60 + float(s)
        return float(text)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# Champions
# --------------------------------------------------------------------------


def champions() -> dict[str, Any]:
    c = client()
    # The current season isn't decided; it's fetched with a short cache.
    drivers = c.all("driverstandings/1", "StandingsTable", "StandingsLists")
    constructors = c.all("constructorstandings/1", "StandingsTable", "StandingsLists")
    by_team = {
        s["season"]: s["ConstructorStandings"][0]
        for s in constructors
        if s.get("ConstructorStandings")
    }
    seasons = []
    for s in drivers:
        row = s["DriverStandings"][0]
        team = by_team.get(s["season"])
        seasons.append(
            {
                "season": int(s["season"]),
                "rounds": int(s.get("round", 0)),
                "decided": int(s["season"]) < _year(),
                "driver": {
                    "id": row["Driver"]["driverId"],
                    "name": _driver_name(row["Driver"]),
                    "nationality": row["Driver"].get("nationality"),
                    "points": float(row.get("points", 0)),
                    "wins": int(row.get("wins", 0)),
                    "team": row["Constructors"][-1]["name"] if row.get("Constructors") else None,
                },
                "constructor": {
                    "id": team["Constructor"]["constructorId"],
                    "name": team["Constructor"]["name"],
                    "points": float(team.get("points", 0)),
                    "wins": int(team.get("wins", 0)),
                }
                if team
                else None,
            }
        )
    seasons.sort(key=lambda s: -s["season"])
    titles = Counter(s["driver"]["name"] for s in seasons if s["decided"])
    team_titles = Counter(
        s["constructor"]["name"] for s in seasons if s["decided"] and s["constructor"]
    )
    return {
        "seasons": seasons,
        "most_driver_titles": [{"name": n, "titles": t} for n, t in titles.most_common(10)],
        "most_constructor_titles": [
            {"name": n, "titles": t} for n, t in team_titles.most_common(10)
        ],
    }


# --------------------------------------------------------------------------
# Drivers
# --------------------------------------------------------------------------


def drivers(search: str = "") -> list[dict[str, Any]]:
    rows = client().all("drivers", "DriverTable", "Drivers")
    q = search.strip().lower()
    out = []
    for d in rows:
        name = _driver_name(d)
        if (
            q
            and q not in name.lower()
            and q not in (d.get("code") or "").lower()
            and q not in d["driverId"]
        ):
            continue
        out.append(
            {
                "id": d["driverId"],
                "name": name,
                "code": d.get("code"),
                "number": d.get("permanentNumber"),
                "nationality": d.get("nationality"),
                "born": d.get("dateOfBirth"),
            }
        )
    out.sort(key=lambda d: d["name"])
    return out


def driver_career(driver_id: str) -> dict[str, Any]:
    if not driver_id.replace("_", "").isalnum():
        raise InvalidParameterError("Driver ids look like 'hamilton' or 'max_verstappen'.")
    c = client()
    info = c.get(f"drivers/{driver_id}")["MRData"]["DriverTable"]["Drivers"]
    if not info:
        raise NotFoundError(f"No driver called '{driver_id}'.")
    d = info[0]
    races = _merge_races(c.all(f"drivers/{driver_id}/results", "RaceTable", "Races"), "Results")
    standings = c.all(f"drivers/{driver_id}/driverstandings", "StandingsTable", "StandingsLists")

    starts = wins = podiums = poles = dnfs = fastest = 0
    points = 0.0
    best: int | None = None
    teams: list[dict[str, Any]] = []
    per_season: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"races": 0, "wins": 0, "podiums": 0, "poles": 0, "points": 0.0, "teams": []}
    )
    for race in races:
        r = race["Results"][0]
        season = int(race["season"])
        team = r["Constructor"]["name"]
        s = per_season[season]
        s["races"] += 1
        if team not in s["teams"]:
            s["teams"].append(team)
        if not teams or teams[-1]["team"] != team:
            teams.append({"team": team, "from": season, "to": season})
        teams[-1]["to"] = season
        starts += 1
        pos = int(r["position"]) if r.get("position", "").isdigit() else None
        pts = float(r.get("points", 0) or 0)
        points += pts
        s["points"] += pts
        if pos == 1:
            wins += 1
            s["wins"] += 1
        if pos is not None and pos <= 3:
            podiums += 1
            s["podiums"] += 1
        if r.get("grid") == "1":
            poles += 1
            s["poles"] += 1
        if r.get("FastestLap", {}).get("rank") == "1":
            fastest += 1
        if not r.get("positionText", "").isdigit():
            dnfs += 1
        if pos is not None and (best is None or pos < best):
            best = pos

    finals = {}
    for s in standings:
        row = s["DriverStandings"][0]
        finals[int(s["season"])] = (
            int(row["position"]) if row.get("position", "").isdigit() else None
        )
    titles = sorted(y for y, p in finals.items() if p == 1 and y < _year())
    seasons = [
        {
            "season": y,
            **{k: v for k, v in per_season[y].items()},
            "points": round(per_season[y]["points"], 1),
            "championship": finals.get(y),
        }
        for y in sorted(per_season)
    ]
    first = races[0] if races else None
    last = races[-1] if races else None
    return {
        "driver": {
            "id": d["driverId"],
            "name": _driver_name(d),
            "code": d.get("code"),
            "number": d.get("permanentNumber"),
            "nationality": d.get("nationality"),
            "born": d.get("dateOfBirth"),
            "wiki": d.get("url"),
        },
        "totals": {
            "starts": starts,
            "wins": wins,
            "podiums": podiums,
            "poles": poles,
            "fastest_laps": fastest,
            "points": round(points, 1),
            "dnfs": dnfs,
            "titles": len(titles),
            "title_years": titles,
            "best_finish": best,
            "win_rate": round(wins / starts * 100, 1) if starts else 0.0,
            "podium_rate": round(podiums / starts * 100, 1) if starts else 0.0,
        },
        "first_race": {"season": int(first["season"]), "name": first["raceName"]}
        if first
        else None,
        "last_race": {"season": int(last["season"]), "name": last["raceName"]} if last else None,
        "teams": teams,
        "seasons": seasons,
    }


# --------------------------------------------------------------------------
# Circuits
# --------------------------------------------------------------------------


def circuits() -> list[dict[str, Any]]:
    rows = client().all("circuits", "CircuitTable", "Circuits", permanent=False)
    return sorted(
        (
            {
                "id": c["circuitId"],
                "name": c["circuitName"],
                "locality": c.get("Location", {}).get("locality"),
                "country": c.get("Location", {}).get("country"),
                "lat": float(c["Location"]["lat"]) if c.get("Location", {}).get("lat") else None,
                "long": float(c["Location"]["long"]) if c.get("Location", {}).get("long") else None,
            }
            for c in rows
        ),
        key=lambda c: c["name"],
    )


def circuit_history(circuit_id: str) -> dict[str, Any]:
    """Winners, pole sitters and how pole times evolved at one circuit."""
    if not circuit_id.replace("_", "").isalnum():
        raise InvalidParameterError("Circuit ids look like 'monza' or 'albert_park'.")
    c = client()
    info = c.get(f"circuits/{circuit_id}")["MRData"]["CircuitTable"]["Circuits"]
    if not info:
        raise NotFoundError(f"No circuit called '{circuit_id}'.")
    winners = _merge_races(
        c.all(f"circuits/{circuit_id}/results/1", "RaceTable", "Races"), "Results"
    )
    quali = _merge_races(
        c.all(f"circuits/{circuit_id}/qualifying/1", "RaceTable", "Races"), "QualifyingResults"
    )
    grid_poles = _merge_races(
        c.all(f"circuits/{circuit_id}/grid/1/results", "RaceTable", "Races"), "Results"
    )

    poles: dict[int, dict[str, Any]] = {}
    for race in grid_poles:
        r = race["Results"][0]
        poles[int(race["season"])] = {
            "season": int(race["season"]),
            "driver": _driver_name(r["Driver"]),
            "team": r["Constructor"]["name"],
            "time": None,
        }
    for race in quali:
        q = race["QualifyingResults"][0]
        times = [_lap_seconds(q.get(k)) for k in ("Q3", "Q2", "Q1")]
        best = min((t for t in times if t), default=None)
        poles[int(race["season"])] = {
            "season": int(race["season"]),
            "driver": _driver_name(q["Driver"]),
            "team": q["Constructor"]["name"],
            "time": round(best, 3) if best else None,
        }

    rows = []
    driver_wins: Counter[str] = Counter()
    team_wins: Counter[str] = Counter()
    for race in winners:
        r = race["Results"][0]
        season = int(race["season"])
        name = _driver_name(r["Driver"])
        team = r["Constructor"]["name"]
        driver_wins[name] += 1
        team_wins[team] += 1
        pole = poles.get(season)
        rows.append(
            {
                "season": season,
                "round": int(race["round"]),
                "race": race["raceName"],
                "winner": name,
                "winner_id": r["Driver"]["driverId"],
                "team": team,
                "grid": int(r["grid"]) if r.get("grid", "").isdigit() else None,
                "pole": pole["driver"] if pole else None,
                "pole_time": pole["time"] if pole else None,
                "fastest_lap": _lap_seconds(r.get("FastestLap", {}).get("Time", {}).get("time")),
            }
        )
    rows.sort(key=lambda r: (-r["season"], -r["round"]))
    from_pole = sum(1 for r in rows if r["grid"] == 1)
    timed = [p for p in poles.values() if p["time"]]
    record = min(timed, key=lambda p: p["time"]) if timed else None
    loc = info[0].get("Location", {})
    return {
        "circuit": {
            "id": info[0]["circuitId"],
            "name": info[0]["circuitName"],
            "locality": loc.get("locality"),
            "country": loc.get("country"),
            "wiki": info[0].get("url"),
        },
        "races": len(rows),
        "first": min((r["season"] for r in rows), default=None),
        "last": max((r["season"] for r in rows), default=None),
        "wins_from_pole": from_pole,
        "pole_win_rate": round(from_pole / len(rows) * 100, 1) if rows else None,
        "most_wins": [{"name": n, "wins": w} for n, w in driver_wins.most_common(5)],
        "most_team_wins": [{"name": n, "wins": w} for n, w in team_wins.most_common(5)],
        "pole_record": record,
        "pole_times": sorted(timed, key=lambda p: p["season"]),
        "results": rows,
    }
