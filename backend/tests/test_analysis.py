"""Driver style, ideal lap, car characteristics, tyre management and the warehouse."""

from __future__ import annotations

import time

import pytest


def test_style_scores_and_corners(client, race_base):
    body = client.get(f"{race_base}/analysis/style", params={"drivers": "VER,NOR"}).json()
    assert body["field_size"] >= 18
    assert [d["code"] for d in body["drivers"]] == ["VER", "NOR"]
    for d in body["drivers"]:
        assert set(d["scores"]) == {a["key"] for a in body["axes"]}
        assert all(v is None or 0 <= v <= 100 for v in d["scores"].values())
        assert len(d["corners"]) >= 6  # detected corners when circuit info is offline
        for c in d["corners"]:
            assert c["class"] in {"slow", "medium", "fast"}
            assert c["apex_speed"] <= c["exit_speed"] + 80
            if c["braked"]:
                assert c["entry_speed"] >= c["apex_speed"]
    assert body["comparison"] and "time_delta" in body["comparison"][0]


def test_ideal_lap_matches_official_sectors(client, race_base):
    body = client.get(f"{race_base}/analysis/ideal-lap", params={"driver": "VER"}).json()
    assert body["ideal_time"] == body["sector_theoretical"]
    assert body["gain"] >= 0
    total_loss = sum(m["loss"] for m in body["minisectors"])
    assert total_loss == pytest.approx(body["gain"], abs=0.02)
    assert {m["sector"] for m in body["minisectors"]} == {1, 2, 3}
    assert body["field"][0]["theoretical"] <= body["field"][-1]["theoretical"]


def test_car_characteristics(client, race_base):
    body = client.get(f"{race_base}/analysis/cars").json()
    assert len(body["teams"]) == 10
    for t in body["teams"]:
        assert t["profile"] in {"Low drag", "High downforce", "Balanced"}
        assert 250 < t["speed_trap"] < 360


def test_tyre_management(client, race_base):
    body = client.get(f"{race_base}/analysis/tyre-management").json()
    scores = [d["score"] for d in body["drivers"]]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 100 for s in scores)
    q = client.get("/api/v1/sessions/2025/3/Q/analysis/tyre-management")
    assert q.status_code in (422, 503)


def test_warehouse_teammates(client, race_base):
    client.get(f"{race_base}/summary")  # loading a session ingests it
    for _ in range(50):
        if client.get("/api/v1/warehouse").json()["sessions"]:
            break
        time.sleep(0.2)
    body = client.get("/api/v1/seasons/2025/teammates").json()
    assert {"season": 2025, "round": 3, "session": "R"} in body["ingested"]
    mclaren = next(p for p in body["pairs"] if p["team"] == "McLaren")
    assert sorted(mclaren["drivers"]) == ["NOR", "PIA"]
    assert sum(mclaren["race"]) >= 1
    assert mclaren["pace_gap"] is not None
    empty = client.get("/api/v1/seasons/2019/teammates")
    assert empty.status_code == 404
