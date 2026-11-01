"""Minimal language-model clients with tool calling, over plain HTTP.

Two wire formats cover almost every provider:

* ``anthropic`` — the Claude Messages API.
* ``openai``    — the Chat Completions format, which OpenAI, Meta's Llama API,
  Groq, Together, vLLM and a local Ollama all speak.

Each client keeps its own transcript in its native format; the agent only
sees :class:`Reply` objects and hands back tool results.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

import requests

from app.core.config import settings

log = logging.getLogger("pitwall.ai")

DEFAULT_MODELS = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-4.1-mini"}
DEFAULT_BASE = {"anthropic": "https://api.anthropic.com/v1", "openai": "https://api.openai.com/v1"}


class LLMError(RuntimeError):
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict[str, Any]


@dataclass
class Reply:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]


def configured() -> bool:
    provider = settings.llm_provider
    if provider not in DEFAULT_MODELS:
        return False
    # Local OpenAI-compatible servers (Ollama) don't need a key.
    return bool(settings.llm_api_key) or (provider == "openai" and bool(settings.llm_base_url))


def describe() -> dict[str, Any]:
    if not configured():
        return {"enabled": False, "provider": None, "model": None}
    provider = settings.llm_provider or ""
    return {
        "enabled": True,
        "provider": provider,
        "model": settings.llm_model or DEFAULT_MODELS[provider],
    }


def _post(url: str, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    try:
        resp = requests.post(url, headers=headers, json=body, timeout=settings.llm_timeout)
    except requests.RequestException as exc:
        raise LLMError(f"Language model unreachable: {exc}") from exc
    if resp.status_code >= 400:
        raise LLMError(f"Language model returned {resp.status_code}: {resp.text[:300]}")
    return resp.json()


class Conversation:
    """One question's worth of model calls."""

    def __init__(self, system: str, tools: list[ToolSpec], max_tokens: int = 1500):
        self.system = system
        self.tools = tools
        self.max_tokens = max_tokens
        self.provider = settings.llm_provider or ""
        self.model = settings.llm_model or DEFAULT_MODELS[self.provider]
        self.base = settings.llm_base_url or DEFAULT_BASE[self.provider]
        self.messages: list[dict[str, Any]] = []

    # -- transcript ----------------------------------------------------------

    def user(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})

    def assistant_text(self, text: str) -> None:
        self.messages.append({"role": "assistant", "content": text})

    def tool_results(self, results: list[tuple[ToolCall, str]]) -> None:
        if self.provider == "anthropic":
            self.messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": call.id, "content": content}
                        for call, content in results
                    ],
                }
            )
        else:
            for call, content in results:
                self.messages.append({"role": "tool", "tool_call_id": call.id, "content": content})

    # -- calls -----------------------------------------------------------------

    def step(self, allow_tools: bool = True) -> Reply:
        if self.provider == "anthropic":
            return self._anthropic(allow_tools)
        return self._openai(allow_tools)

    def _anthropic(self, allow_tools: bool) -> Reply:
        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": self.system,
            "messages": self.messages,
        }
        if allow_tools and self.tools:
            body["tools"] = [
                {"name": t.name, "description": t.description, "input_schema": t.parameters}
                for t in self.tools
            ]
        data = _post(
            f"{self.base}/messages",
            {
                "x-api-key": settings.llm_api_key or "",
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body,
        )
        blocks = data.get("content") or []
        self.messages.append({"role": "assistant", "content": blocks})
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        calls = [
            ToolCall(b["id"], b["name"], b.get("input") or {})
            for b in blocks
            if b.get("type") == "tool_use"
        ]
        return Reply(text.strip(), calls)

    def _openai(self, allow_tools: bool) -> Reply:
        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": [{"role": "system", "content": self.system}, *self.messages],
        }
        if allow_tools and self.tools:
            body["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    },
                }
                for t in self.tools
            ]
        headers = {"content-type": "application/json"}
        if settings.llm_api_key:
            headers["authorization"] = f"Bearer {settings.llm_api_key}"
        data = _post(f"{self.base}/chat/completions", headers, body)
        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError) as exc:
            raise LLMError("Unexpected response from the language model.") from exc
        self.messages.append(
            {k: v for k, v in message.items() if k in {"role", "content", "tool_calls"}}
        )
        calls = []
        for tc in message.get("tool_calls") or []:
            fn = tc.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            calls.append(ToolCall(tc.get("id", fn.get("name", "")), fn.get("name", ""), args))
        return Reply((message.get("content") or "").strip(), calls)
