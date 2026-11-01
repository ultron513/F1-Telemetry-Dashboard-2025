"""Live mode: message merging, parsing, engine analytics and the WebSocket."""

from __future__ import annotations

import pytest

from app.live import analytics
from app.live.sources import clock_seconds, parse_live_line
from app.live.state import LiveState, gap_value, lap_seconds, merge


def test_merge_follows_f1_patch_rules():
    base = {"Lines": {"1": {"Stints": [{"Compound": "MEDIUM", "TotalLaps": 3}]}}}
    patched = merge(
        base, {"Lines": {"1": {"Stints": {"0": {"TotalLaps": 4}, "1": {"Compound": "HARD"}}}}}
    )
    stints = patched["Lines"]["1"]["Stints"]
    assert stints[0] == {"Compound": "MEDIUM", "TotalLaps": 4}
    assert stints[1] == {"Compound": "HARD"}
    assert base["Lines"]["1"]["Stints"][0]["TotalLaps"] == 3  # input not mutated
    assert merge({"a": 1, "b": 2}, {"_deleted": ["a"]}) == {"b": 2}


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("+1.234", (1.234, 0)),
        ("LAP 12", (0.0, 0)),
        ("1L", (None, 1)),
        ("2 LAPS", (None, 2)),
        ("", (None, 0)),
    ],
)
def test_gap_parsing(text, expected):
    assert gap_value(text) == expected


def test_time_parsing():
    assert lap_seconds("1:33.079") == pytest.approx(93.079)
    assert lap_seconds("59.5") == 59.5
    assert lap_seconds("") is None
    assert clock_seconds("01:36:40.688") == pytest.approx(5800.688)


def test_parse_signalr_lines():
    feed = parse_live_line(
        "['TrackStatus', {'Status': '4', 'Message': 'SCDeployed'}, '2025-04-06T05:00:00.123Z']"
    )
    assert feed.topic == "TrackStatus" and feed.data["Status"] == "4" and feed.t > 0
    first = parse_live_line("['LapCount', '{\"CurrentLap\": 3, \"TotalLaps\": 53}', '']")
    assert first.data == {"CurrentLap": 3, "TotalLaps": 53}
    assert parse_live_line("garbage") is None


def _row(number, code, position, gap, compounds=("MEDIUM",)):
    return {
        "number": number,
        "code": code,
        "position": position,
        "gap": gap,
        "laps_down": 0,
        "retired": False,
        "team_color": None,
        "compounds_used": list(compounds),
        "in_pit": False,
        "pit_out": False,
        "pit_stops": 0,
        "laps": 10,
        "last_lap": 90.0,
        "last_lap_overall_best": False,
    }


def test_pit_window_and_probabilities():
    rows = [
        _row("1", "AAA", 1, 0.0),
        _row("2", "BBB", 2, 5.0),
        _row("3", "CCC", 3, 30.0, ("MEDIUM", "HARD")),
    ]
    window = {w["code"]: w for w in analytics.pit_window(rows, 22.0)}
    assert window["AAA"]["rejoin_position"] == 2 and window["AAA"]["car_ahead"] == "BBB"
    assert window["CCC"]["free_stop"] and not window["CCC"]["owes_stop"]
    assert window["AAA"]["owes_stop"]

    probs = analytics.probabilities(rows, analytics.PaceTracker(), laps_left=20, pit_loss=22.0)
    assert sum(p["win"] for p in probs) == pytest.approx(1.0, abs=1e-6)
    assert probs[0]["code"] == "AAA"
    # CCC is 30 s back but has already stopped; the others still owe 22 s.
    ccc = next(p for p in probs if p["code"] == "CCC")
    assert ccc["win"] > 0.01
    final = analytics.probabilities(rows, analytics.PaceTracker(), laps_left=0, pit_loss=22.0)
    assert final[0]["win"] == 1.0


def test_alerts_from_snapshot_diff():
    state = LiveState()
    prev = {
        "track_status": {"code": "1"},
        "drivers": [_row("1", "AAA", 1, 0.0), _row("2", "BBB", 2, 1.0)],
        "race_control": [],
        "weather": {"rain": False},
    }
    cur = {
        "lap": 5,
        "clock": "x",
        "track_status": {"code": "4"},
        "drivers": [_row("2", "BBB", 1, 0.0), {**_row("1", "AAA", 2, 1.0), "in_pit": True}],
        "race_control": [{"message": "CAR 1 (AAA) 5 SECOND TIME PENALTY", "flag": None}],
        "weather": {"rain": True},
    }
    kinds = {a["kind"] for a in analytics.alerts(prev, cur)}
    assert {"safety-car", "lead-change", "pit", "penalty", "rain"} <= kinds
    assert analytics.alerts(None, cur) == []
    assert state.drivers() == []


def test_archive_replay_over_websocket(client, race_base):
    url = "/api/v1/live/ws?mode=archive&season=2025&round=3&session=R&speed=120&start=3000"
    try:
        with client.websocket_connect(url) as ws:
            hello = ws.receive_json()
            if hello["type"] == "error":
                pytest.skip(hello["message"])
            assert hello["type"] == "hello" and hello["duration"] > 4000
            snap = ws.receive_json()
            assert snap["type"] == "snapshot"
            assert snap["lap"] and snap["lap"] > 20
            assert len(snap["drivers"]) == 20
            assert (
                snap["probabilities"]
                and abs(sum(p["win"] for p in snap["probabilities"]) - 1) < 1e-6
            )
            ws.send_json({"seek": 6000})
            nxt = ws.receive_json()
            while nxt.get("replay", {}).get("position", 0) < 5990:
                nxt = ws.receive_json()
            assert nxt["lap"] > snap["lap"]
    except Exception as exc:  # pragma: no cover
        if "not available" in str(exc):
            pytest.skip(str(exc))
        raise


def test_live_status(client):
    body = client.get("/api/v1/live/status").json()
    assert "live" in body and "next" in body and body["feed_running"] is False
