"""Strategy simulator: model fit, plan parsing, calibration and the calculators."""

from __future__ import annotations

import pytest

from app.core.errors import InvalidParameterError
from app.services import simulator as sim


def test_parse_plan_aliases_and_ages():
    assert sim.parse_plan("m:20, H:33") == [("MEDIUM", 20, 0), ("HARD", 33, 0)]
    assert sim.parse_plan("S:10:3,I:5") == [("SOFT", 10, 3), ("INTERMEDIATE", 5, 0)]
    assert sim.format_plan([("SOFT", 10, 3), ("HARD", 40, 0)]) == "S:10:3,H:40"
    for bad in ("", "M", "M:x", "M:0"):
        with pytest.raises(InvalidParameterError):
            sim.parse_plan(bad)


def test_model_fit_is_physical(client, race_base):
    body = client.get(f"{race_base}/simulator/model", params={"driver": "VER"}).json()
    assert body["fit_r2"] > 0.8
    assert body["fuel_effect"] < 0  # cars get faster as fuel burns
    wear = {c["compound"]: c["wear"] for c in body["compounds"]}
    assert wear["SOFT"] > wear["MEDIUM"] > wear["HARD"] > 0
    assert sum(s["laps"] for s in body["actual_plan"]) == body["total_laps"]


def test_actual_plan_reproduces_real_result(client, race_base):
    model = client.get(f"{race_base}/simulator/model", params={"driver": "VER"}).json()
    plan = ",".join(f"{s['compound'][0]}:{s['laps']}" for s in model["actual_plan"])
    body = client.get(
        f"{race_base}/simulator/simulate", params={"driver": "VER", "plan": plan}
    ).json()
    assert body["hindsight"]["delta"] == 0
    assert body["hindsight"]["position"] == body["hindsight"]["actual_position"]
    assert body["monte_carlo"]["delta_mean"] == 0
    shares = sum(p["share"] for p in body["monte_carlo"]["position_histogram"])
    assert shares == pytest.approx(1, abs=0.01)


def test_plan_validation(client, race_base):
    r = client.get(f"{race_base}/simulator/simulate", params={"driver": "VER", "plan": "M:20"})
    assert r.status_code == 422
    r = client.get(f"{race_base}/simulator/simulate", params={"driver": "VER", "plan": "M:20,M:33"})
    assert r.status_code == 200
    assert any("two different compounds" in w for w in r.json()["warnings"])


def test_optimiser_beats_or_matches_reality(client, race_base):
    body = client.get(f"{race_base}/simulator/optimise", params={"driver": "VER"}).json()
    assert body["evaluated"] > 1000
    best = body["plans"][0]
    assert best["delta"] <= 0
    assert sum(s["laps"] for s in best["stints"]) == body["laps"]
    assert len({s["compound"] for s in best["stints"]}) >= 2


def test_undercut_scenarios(client, race_base):
    body = client.get(
        f"{race_base}/simulator/undercut",
        params={"attacker": "NOR", "defender": "VER", "lap": 18},
    ).json()
    assert body["verdict"] in {"undercut", "overcut", "stay", "safe", "cover", "stay-out", "lose"}
    for key in ("undercut", "overcut"):
        s = body[key]
        assert s["gaps"][-1]["gap"] == s["final_gap"]
        assert s["attacker_ahead"] == (s["final_gap"] < 0)
    same = client.get(
        f"{race_base}/simulator/undercut",
        params={"attacker": "VER", "defender": "VER", "lap": 18},
    )
    assert same.status_code == 422


def test_simulator_rejects_qualifying(client):
    r = client.get("/api/v1/sessions/2025/3/Q/simulator/model")
    assert r.status_code == 422
