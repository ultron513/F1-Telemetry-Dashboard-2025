from __future__ import annotations

import pytest


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_seasons(client):
    body = client.get("/api/v1/seasons").json()
    assert 2025 in body["seasons"]
    assert body["default_season"] in body["seasons"]


def test_calendar(client, race_base):
    body = client.get("/api/v1/seasons/2025/events").json()
    assert len(body["events"]) >= 20
    japan = next(e for e in body["events"] if e["round"] == 3)
    assert japan["country"] == "Japan"
    assert {s["code"] for s in japan["sessions"]} >= {"Q", "R"}


def test_unsupported_season(client):
    r = client.get("/api/v1/seasons/1999/events")
    assert r.status_code == 422


def test_summary(client, race_base):
    body = client.get(f"{race_base}/summary").json()
    assert body["highlights"]["winner"] == "VER"
    assert body["highlights"]["podium"] == ["VER", "NOR", "PIA"]
    assert body["results"][0]["points"] == 25
    assert len(body["drivers"]) == 20


def test_lap_table_grades(client, race_base):
    body = client.get(f"{race_base}/laps", params={"driver": "ver"}).json()
    assert body["driver"]["code"] == "VER"
    grades = {lap["grade"] for lap in body["laps"]}
    assert "green" in grades
    assert body["stats"]["pit_stops"] == 1


@pytest.mark.parametrize("lap", [None, "fastest", "20"])
def test_telemetry(client, race_base, lap):
    params = {"driver": "NOR"}
    if lap:
        params["lap"] = lap
    body = client.get(f"{race_base}/telemetry", params=params).json()
    ch = body["channels"]
    n = len(ch["distance"])
    assert n > 500
    assert all(len(ch[k]) == n for k in ("speed", "throttle", "brake", "gear", "x", "y"))
    assert 250 < body["stats"]["max_speed"] < 360
    assert set(ch["drs"]) <= {0, 1}


def test_compare_delta(client, race_base):
    body = client.get(f"{race_base}/compare", params={"driver_a": "VER", "driver_b": "NOR"}).json()
    assert len(body["delta"]) == len(body["distance"])
    assert len(body["minisectors"]) == 25
    total = sum(s["delta"] for s in body["sectors"] if s["delta"] is not None)
    assert abs(total - body["final_delta"]) < 0.4


def test_strategy(client, race_base):
    body = client.get(f"{race_base}/strategy").json()
    ver = next(d for d in body["stints"] if d["code"] == "VER")
    assert [s["compound"] for s in ver["stints"]] == ["MEDIUM", "HARD"]
    assert body["pit_stops"], "expected pit stops"
    assert all(15 < s["pit_lane_time"] < 40 for s in body["pit_stops"] if s["pit_lane_time"])


def test_race_control(client, race_base):
    body = client.get(f"{race_base}/race-control").json()
    kinds = {m["kind"] for m in body["messages"]}
    assert "chequered" in kinds
    assert "blue" in kinds


def test_replay_shape(client, race_base):
    body = client.get(f"{race_base}/replay", params={"step": 2}).json()
    assert body["frames"] > 1000
    for d in body["drivers"]:
        assert len(d["progress"]) == body["frames"]
        assert d["progress"] == sorted(d["progress"]), "progress must be monotonic"


def test_errors(client, race_base):
    assert client.get(f"{race_base}/laps", params={"driver": "ZZZ"}).status_code == 404
    assert (
        client.get(f"{race_base}/telemetry", params={"driver": "VER", "lap": "999"}).status_code
        == 404
    )
    assert client.get("/api/v1/sessions/2025/3/XX/summary").status_code == 422
    assert client.get("/api/v1/sessions/2025/40/R/summary").status_code == 422
