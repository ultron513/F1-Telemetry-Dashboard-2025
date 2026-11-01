from __future__ import annotations

import json

import httpx
import pytest

from pitwall_client import ApiError, PitWall


def make(handler):
    return PitWall("http://api.test", transport=httpx.MockTransport(handler))


def test_session_paths_and_params():
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append((req.url.path, dict(req.url.params)))
        return httpx.Response(200, json={"ok": True})

    pw = make(handler)
    race = pw.session(2025, 3, "r")
    race.compare("VER", "NOR")
    race.simulate("VER", [("MEDIUM", 20), ("HARD", 33)])
    race.style("VER", "NOR")
    race.tyre_model()
    pw.standings(2025)
    assert seen[0] == (
        "/api/v1/sessions/2025/3/R/compare",
        {"driver_a": "VER", "driver_b": "NOR", "lap_a": "fastest", "lap_b": "fastest"},
    )
    assert seen[1] == (
        "/api/v1/sessions/2025/3/R/simulator/simulate",
        {"driver": "VER", "plan": "M:20,H:33", "runs": "400"},
    )
    assert seen[2][1] == {"drivers": "VER,NOR"}
    assert seen[3] == ("/api/v1/sessions/2025/3/R/simulator/model", {})
    assert seen[4] == ("/api/v1/seasons/2025/standings", {})


def test_errors_are_typed():
    def handler(req):
        return httpx.Response(
            404, json={"error": {"code": "not_found", "message": "No lap 99.", "hint": "Laps 1–53"}}
        )

    with pytest.raises(ApiError) as exc:
        make(handler).session(2025, 3, "R").telemetry("VER", 99)
    assert (
        exc.value.status == 404 and exc.value.code == "not_found" and exc.value.hint == "Laps 1–53"
    )


def test_validation_errors_and_post():
    def handler(req):
        if req.method == "POST":
            body = json.loads(req.content)
            assert req.headers["X-Admin-Token"] == "t0k"
            return httpx.Response(200, json={"queued": 1, "echo": body})
        return httpx.Response(
            422, json={"detail": [{"msg": "Input should be greater than or equal to 1"}]}
        )

    pw = PitWall("http://api.test", admin_token="t0k", transport=httpx.MockTransport(handler))
    assert pw.ingest(2025, 3, ["R"])["echo"] == {
        "season": 2025,
        "round": 3,
        "sessions": ["R"],
        "warm": True,
    }
    with pytest.raises(ApiError, match="greater than"):
        pw.get("/x")
