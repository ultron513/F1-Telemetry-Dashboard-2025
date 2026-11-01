"""History: Ergast-format parsing, paging, disk cache and the endpoints.

Uses a fake client serving responses in Jolpica's exact Ergast JSON shape,
so the tests need no network.
"""

from __future__ import annotations

import json

import pytest

from app.core.errors import DataUnavailableError
from app.services import history


def drv(did, given, family, code=None, nat="British"):
    return {
        "driverId": did,
        "givenName": given,
        "familyName": family,
        "code": code,
        "nationality": nat,
        "dateOfBirth": "1985-01-07",
        "url": f"https://en.wikipedia.org/wiki/{family}",
    }


def team(cid, name):
    return {"constructorId": cid, "name": name}


HAM = drv("hamilton", "Lewis", "Hamilton", "HAM")
VER = drv("max_verstappen", "Max", "Verstappen", "VER", "Dutch")
MER = team("mercedes", "Mercedes")
RBR = team("red_bull", "Red Bull")


def result(d, t, pos, grid, pts, fl_rank="2", fl_time="1:21.0"):
    return {
        "position": str(pos),
        "positionText": str(pos),
        "points": str(pts),
        "grid": str(grid),
        "Driver": d,
        "Constructor": t,
        "FastestLap": {"rank": fl_rank, "Time": {"time": fl_time}},
    }


def race(season, rnd, name, rows, key="Results"):
    return {"season": str(season), "round": str(rnd), "raceName": name, key: rows}


class FakeClient(history.JolpicaClient):
    def __init__(self):
        super().__init__(cache_dir=None, offline=False)
        self.calls = []
        many = [drv(f"d{i:03d}", "Test", f"Driver{i:03d}") for i in range(148)] + [HAM, VER]
        self.collections = {
            "drivers": ("DriverTable", "Drivers", many),
            "driverstandings/1": (
                "StandingsTable",
                "StandingsLists",
                [
                    {
                        "season": "2020",
                        "round": "17",
                        "DriverStandings": [
                            {
                                "position": "1",
                                "points": "347",
                                "wins": "11",
                                "Driver": HAM,
                                "Constructors": [MER],
                            }
                        ],
                    },
                    {
                        "season": "2021",
                        "round": "22",
                        "DriverStandings": [
                            {
                                "position": "1",
                                "points": "395.5",
                                "wins": "10",
                                "Driver": VER,
                                "Constructors": [RBR],
                            }
                        ],
                    },
                ],
            ),
            "constructorstandings/1": (
                "StandingsTable",
                "StandingsLists",
                [
                    {
                        "season": "2020",
                        "ConstructorStandings": [
                            {"points": "573", "wins": "13", "Constructor": MER}
                        ],
                    },
                    {
                        "season": "2021",
                        "ConstructorStandings": [
                            {"points": "613.5", "wins": "9", "Constructor": MER}
                        ],
                    },
                ],
            ),
            "drivers/hamilton/results": (
                "RaceTable",
                "Races",
                [
                    race(
                        2007,
                        1,
                        "Australian Grand Prix",
                        [result(HAM, team("mclaren", "McLaren"), 3, 4, 6)],
                    ),
                    race(
                        2007,
                        2,
                        "Malaysian Grand Prix",
                        [result(HAM, team("mclaren", "McLaren"), 2, 4, 8, "1")],
                    ),
                    race(2020, 1, "Austrian Grand Prix", [result(HAM, MER, 4, 5, 12)]),
                    race(2020, 8, "Italian Grand Prix", [result(HAM, MER, 7, 1, 6)]),
                    race(2020, 9, "Tuscan Grand Prix", [result(HAM, MER, 1, 1, 26, "1")]),
                    race(
                        2020,
                        10,
                        "Russian Grand Prix",
                        [{**result(HAM, MER, 20, 1, 0), "positionText": "R", "position": "20"}],
                    ),
                ],
            ),
            "drivers/hamilton/driverstandings": (
                "StandingsTable",
                "StandingsLists",
                [
                    {"season": "2007", "DriverStandings": [{"position": "2"}]},
                    {"season": "2020", "DriverStandings": [{"position": "1"}]},
                ],
            ),
            "circuits": (
                "CircuitTable",
                "Circuits",
                [
                    {
                        "circuitId": "monza",
                        "circuitName": "Autodromo Nazionale di Monza",
                        "Location": {
                            "lat": "45.6",
                            "long": "9.28",
                            "locality": "Monza",
                            "country": "Italy",
                        },
                    }
                ],
            ),
            "circuits/monza/results/1": (
                "RaceTable",
                "Races",
                [
                    race(
                        1950,
                        7,
                        "Italian Grand Prix",
                        [
                            result(
                                drv("farina", "Nino", "Farina"), team("alfa", "Alfa Romeo"), 1, 1, 8
                            )
                        ],
                    ),
                    race(
                        2020,
                        8,
                        "Italian Grand Prix",
                        [
                            result(
                                drv("gasly", "Pierre", "Gasly"),
                                team("alphatauri", "AlphaTauri"),
                                1,
                                10,
                                25,
                            )
                        ],
                    ),
                    race(
                        2021,
                        14,
                        "Italian Grand Prix",
                        [
                            result(
                                drv("ricciardo", "Daniel", "Ricciardo"),
                                team("mclaren", "McLaren"),
                                1,
                                2,
                                26,
                            )
                        ],
                    ),
                ],
            ),
            "circuits/monza/qualifying/1": (
                "RaceTable",
                "Races",
                [
                    race(
                        2020,
                        8,
                        "Italian Grand Prix",
                        [
                            {
                                "Driver": HAM,
                                "Constructor": MER,
                                "Q1": "1:19.514",
                                "Q2": "1:19.092",
                                "Q3": "1:18.887",
                            }
                        ],
                        "QualifyingResults",
                    ),
                    race(
                        2021,
                        14,
                        "Italian Grand Prix",
                        [
                            {
                                "Driver": drv("bottas", "Valtteri", "Bottas"),
                                "Constructor": MER,
                                "Q1": "1:20.685",
                                "Q2": "1:20.032",
                                "Q3": "1:19.555",
                            }
                        ],
                        "QualifyingResults",
                    ),
                ],
            ),
            "circuits/monza/grid/1/results": (
                "RaceTable",
                "Races",
                [
                    race(
                        1950,
                        7,
                        "Italian Grand Prix",
                        [
                            result(
                                drv("fangio", "Juan", "Fangio"), team("alfa", "Alfa Romeo"), 0, 1, 0
                            )
                        ],
                    ),
                ],
            ),
        }
        self.single = {
            "drivers/hamilton": {"MRData": {"DriverTable": {"Drivers": [HAM]}}},
            "drivers/nobody": {"MRData": {"DriverTable": {"Drivers": []}}},
            "circuits/monza": {
                "MRData": {
                    "CircuitTable": {
                        "Circuits": [
                            {
                                "circuitId": "monza",
                                "circuitName": "Autodromo Nazionale di Monza",
                                "Location": {"locality": "Monza", "country": "Italy"},
                            }
                        ]
                    }
                }
            },
        }

    def get(self, path, *, permanent=False, **params):
        self.calls.append((path, params))
        if path in self.single:
            return self.single[path]
        table, rows, items = self.collections[path]
        limit, offset = params.get("limit", 30), params.get("offset", 0)
        return {"MRData": {"total": str(len(items)), table: {rows: items[offset : offset + limit]}}}


@pytest.fixture()
def fake():
    old = history.client()
    f = FakeClient()
    history.set_client(f)
    yield f
    history.set_client(old)


def test_paging_reads_every_row(fake):
    rows = history.drivers()
    assert len(rows) == 150
    assert [c for c in fake.calls if c[0] == "drivers"] == [
        ("drivers", {"limit": 100, "offset": 0}),
        ("drivers", {"limit": 100, "offset": 100}),
    ]
    assert [d["id"] for d in history.drivers("verst")] == ["max_verstappen"]


def test_champions(client, fake):
    body = client.get("/api/v1/history/champions").json()
    assert [s["season"] for s in body["seasons"]] == [2021, 2020]
    assert body["seasons"][0]["driver"]["name"] == "Max Verstappen"
    assert body["seasons"][1]["constructor"]["name"] == "Mercedes"
    assert body["most_constructor_titles"][0] == {"name": "Mercedes", "titles": 2}


def test_driver_career(client, fake):
    body = client.get("/api/v1/history/drivers/hamilton").json()
    t = body["totals"]
    assert (t["starts"], t["wins"], t["podiums"], t["poles"], t["fastest_laps"], t["dnfs"]) == (
        6,
        1,
        3,
        3,
        2,
        1,
    )
    assert t["points"] == 58 and t["titles"] == 1 and t["title_years"] == [2020]
    assert [s["team"] for s in body["teams"]] == ["McLaren", "Mercedes"]
    assert body["teams"][0] == {"team": "McLaren", "from": 2007, "to": 2007}
    s2020 = next(s for s in body["seasons"] if s["season"] == 2020)
    assert s2020["races"] == 4 and s2020["championship"] == 1
    assert client.get("/api/v1/history/drivers/nobody").status_code == 404
    assert client.get("/api/v1/history/drivers/Bad%20Id").status_code == 422


def test_circuit_history(client, fake):
    body = client.get("/api/v1/history/circuits/monza").json()
    assert body["races"] == 3 and body["first"] == 1950 and body["last"] == 2021
    assert body["pole_record"] == {
        "season": 2020,
        "driver": "Lewis Hamilton",
        "team": "Mercedes",
        "time": 78.887,
    }
    assert [p["season"] for p in body["pole_times"]] == [2020, 2021]
    r1950 = next(r for r in body["results"] if r["season"] == 1950)
    assert r1950["pole"] == "Juan Fangio" and r1950["pole_time"] is None
    assert body["wins_from_pole"] == 1
    listing = client.get("/api/v1/history/circuits").json()["circuits"]
    assert listing[0]["id"] == "monza" and listing[0]["lat"] == 45.6


def test_disk_cache_and_offline(tmp_path, monkeypatch):
    calls = []

    class Resp:
        status_code = 200

        def json(self):
            return {"MRData": {"total": "0"}}

    monkeypatch.setattr(history.requests, "get", lambda *a, **k: calls.append(a) or Resp())
    c = history.JolpicaClient(base_url="https://example.test/f1", cache_dir=tmp_path, offline=False)
    c.get("seasons", permanent=True)
    c.get("seasons", permanent=True)
    assert len(calls) == 1
    assert len(list(tmp_path.glob("*.json"))) == 1
    off = history.JolpicaClient(
        base_url="https://example.test/f1", cache_dir=tmp_path, offline=True
    )
    assert off.get("seasons") == {"MRData": {"total": "0"}}
    with pytest.raises(DataUnavailableError):
        off.get("circuits")
    assert json.loads(next(tmp_path.glob("*.json")).read_text())["MRData"]["total"] == "0"
