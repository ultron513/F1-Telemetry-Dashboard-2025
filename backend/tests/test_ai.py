"""AI layer: reports, the rule-based analyst and the model tool loop (mocked)."""

from __future__ import annotations

import dataclasses

import pytest

from app.ai import agent, llm
from app.core import config


def _use(monkeypatch, **overrides):
    """Settings are frozen; swap in a modified copy where the AI layer reads them."""
    patched = dataclasses.replace(config.settings, **overrides)
    for module in (llm, agent):
        monkeypatch.setattr(module, "settings", patched)


@pytest.fixture()
def no_llm(monkeypatch):
    _use(monkeypatch, llm_provider=None)


def test_status_without_model(client, no_llm):
    body = client.get("/api/v1/ai/status").json()
    assert body == {"enabled": False, "provider": None, "model": None, "fallback": "rules"}


def test_race_report(client, race_base, no_llm):
    rep = client.get(f"{race_base}/report").json()
    assert rep["mode"] == "template"
    assert "Verstappen" in rep["headline"]
    titles = [s["title"] for s in rep["sections"]]
    assert {"How it unfolded", "Strategy", "Pace"} <= set(titles)
    # Japan 2025: Antonelli led during the stops cycle.
    assert {"lap": 22, "kind": "lead", "text": "ANT takes the lead from VER"} in rep["moments"]
    assert {"label": "Lead changes", "value": "2"} in rep["stats"]


def test_suggestions(client, race_base, no_llm):
    body = client.get(f"{race_base}/ask/suggestions").json()
    assert body["suggestions"][0] == "Why did NOR finish behind VER?"
    assert body["assistant"]["enabled"] is False


@pytest.mark.parametrize(
    ("question", "intent", "chart", "snippet"),
    [
        ("Who won?", "results", "results", "VER won the Japanese Grand Prix"),
        ("Why did Norris finish behind Verstappen?", "compare", "race-trace", "Verdict"),
        ("Where did Max beat Lando on his fastest lap?", "compare", "compare", "quicker"),
        ("How did the tyre strategies compare?", "strategy", "strategy", "1-stop"),
        ("What was Hamilton's strategy?", "strategy", "strategy", "HAM: 1-stop"),
        ("Any safety cars or penalties?", "race_control", "race-control", "No safety cars"),
        ("Could Norris have undercut Verstappen on lap 19?", "undercut", "undercut", "Undercut"),
        ("How bad was Leclerc's tyre degradation?", "degradation", "degradation", "LEC"),
        ("What were the conditions like?", "weather", "weather", "°C"),
        ("Who had the best pace?", "pace", "pace", "PIA had the best median pace"),
        ("Tell me about Piastri", "driver", "strategy", "Oscar Piastri"),
    ],
)
def test_rule_analyst(client, race_base, no_llm, question, intent, chart, snippet):
    body = client.post(f"{race_base}/ask", json={"question": question}).json()
    assert body["mode"] == "rules"
    assert body["intent"] == intent
    assert chart in [c["type"] for c in body["charts"]]
    assert snippet in body["answer"]
    assert body["follow_ups"]


def test_ask_validation(client, race_base):
    assert client.post(f"{race_base}/ask", json={"question": ""}).status_code == 422


def test_driver_resolution(race_base, client):
    from app.ai.facts import find_drivers
    from app.data.schedule import resolve_session

    ref = resolve_session(2025, 3, "R")
    assert find_drivers(ref, "lando vs Max Verstappen") == ["NOR", "VER"]
    assert set(find_drivers(ref, "how did ferrari do")) == {"LEC", "HAM"}
    assert find_drivers(ref, "nothing relevant here") == []


# --- model analyst with a mocked provider ---------------------------------------


class FakeResponse:
    def __init__(self, payload, status=200):
        self.payload = payload
        self.status_code = status
        self.text = str(payload)

    def json(self):
        return self.payload


def _configure(monkeypatch, provider, **extra):
    _use(
        monkeypatch,
        llm_provider=provider,
        llm_api_key="test-key",
        llm_model=None,
        llm_base_url=None,
        **extra,
    )


def test_anthropic_tool_loop(client, race_base, monkeypatch):
    _configure(monkeypatch, "anthropic")
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(json)
        assert url == "https://api.anthropic.com/v1/messages"
        assert headers["x-api-key"] == "test-key"
        if len(calls) == 1:
            assert {t["name"] for t in json["tools"]} >= {"head_to_head", "strategy"}
            return FakeResponse(
                {
                    "content": [
                        {"type": "text", "text": "Checking."},
                        {
                            "type": "tool_use",
                            "id": "t1",
                            "name": "head_to_head",
                            "input": {"driver_a": "VER", "driver_b": "NOR"},
                        },
                    ]
                }
            )
        result = json["messages"][-1]["content"][0]
        assert result["type"] == "tool_result" and result["tool_use_id"] == "t1"
        assert '"finish":[1,2]' in result["content"]
        return FakeResponse({"content": [{"type": "text", "text": "**VER held track position.**"}]})

    monkeypatch.setattr(llm.requests, "post", fake_post)
    body = client.post(
        f"{race_base}/ask",
        json={
            "question": "Why did Norris lose?",
            "history": [
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "hello"},
            ],
        },
    ).json()
    assert body["mode"] == "llm"
    assert body["model"] == "claude-sonnet-5-5"
    assert body["answer"] == "**VER held track position.**"
    assert body["tools"] == [
        {"name": "head_to_head", "args": {"driver_a": "VER", "driver_b": "NOR"}}
    ]
    assert [c["type"] for c in body["charts"]] == ["race-trace", "compare"]
    assert calls[0]["messages"][0] == {"role": "user", "content": "hi"}


def test_openai_compatible_tool_loop(client, race_base, monkeypatch):
    _configure(monkeypatch, "openai")
    _use(
        monkeypatch,
        llm_provider="openai",
        llm_api_key=None,
        llm_base_url="http://localhost:11434/v1",
        llm_model="llama3.1",
    )
    step = {"n": 0}

    def fake_post(url, headers, json, timeout):
        step["n"] += 1
        assert url == "http://localhost:11434/v1/chat/completions"
        assert json["model"] == "llama3.1"
        if step["n"] == 1:
            return FakeResponse(
                {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [
                                    {
                                        "id": "c1",
                                        "type": "function",
                                        "function": {"name": "race_control", "arguments": "{}"},
                                    }
                                ],
                            }
                        }
                    ]
                }
            )
        assert json["messages"][-1]["role"] == "tool"
        return FakeResponse(
            {"choices": [{"message": {"role": "assistant", "content": "**No safety cars.**"}}]}
        )

    monkeypatch.setattr(llm.requests, "post", fake_post)
    body = client.post(f"{race_base}/ask", json={"question": "Any safety cars?"}).json()
    assert body["mode"] == "llm"
    assert body["answer"] == "**No safety cars.**"
    assert body["charts"] == [{"type": "race-control"}]


def test_falls_back_when_model_fails(client, race_base, monkeypatch):
    _configure(monkeypatch, "anthropic")
    monkeypatch.setattr(llm.requests, "post", lambda *a, **k: FakeResponse({"error": "x"}, 529))
    body = client.post(f"{race_base}/ask", json={"question": "Who won?"}).json()
    assert body["mode"] == "rules"
    assert "unavailable" in body["notice"]
    assert "VER won" in body["answer"]


def test_report_narration_keeps_template_on_bad_json(client, race_base, monkeypatch):
    from app.ai import report

    _configure(monkeypatch, "anthropic")
    report.narrated_report.cache.clear()
    monkeypatch.setattr(
        llm.requests,
        "post",
        lambda *a, **k: FakeResponse({"content": [{"type": "text", "text": "not json"}]}),
    )
    rep = client.get(f"{race_base}/report").json()
    assert rep["mode"] == "template"

    report.narrated_report.cache.clear()
    monkeypatch.setattr(
        llm.requests,
        "post",
        lambda *a, **k: FakeResponse(
            {
                "content": [
                    {
                        "type": "text",
                        "text": '{"headline": "Max masters Suzuka", "standfirst": "s", "sections": [{"title": "T", "body": "B"}]}',
                    }
                ]
            }
        ),
    )
    rep = client.get(f"{race_base}/report").json()
    assert rep["mode"] == "llm" and rep["headline"] == "Max masters Suzuka"
    report.narrated_report.cache.clear()


def test_follow_ups_skip_topics_already_asked(client, race_base, no_llm):
    body = client.post(
        f"{race_base}/ask",
        json={
            "question": "Could Norris have undercut Verstappen on lap 19?",
            "history": [
                {"role": "user", "content": "Why did Lando finish behind Max?"},
                {"role": "assistant", "content": "..."},
            ],
        },
    ).json()
    joined = " ".join(body["follow_ups"])
    assert "undercut" not in joined
    assert "Why did NOR finish behind VER" not in joined
    assert body["follow_ups"]
