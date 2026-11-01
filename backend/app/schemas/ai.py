"""Schemas for the AI layer: race reports and the pit wall assistant."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from app.schemas.common import Model, SessionContext


class ReportSection(Model):
    title: str
    body: str


class ReportMoment(Model):
    lap: int | None = None
    kind: str
    text: str


class ReportStat(Model):
    label: str
    value: str


class ReportResponse(SessionContext):
    event: str
    mode: Literal["template", "llm"]
    model: str | None = None
    headline: str
    standfirst: str
    sections: list[ReportSection]
    moments: list[ReportMoment]
    stats: list[ReportStat]


class ChatTurn(Model):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AskRequest(Model):
    question: str = Field(min_length=2, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class ToolUse(Model):
    name: str
    args: dict[str, Any]


class AskResponse(SessionContext):
    question: str
    mode: Literal["rules", "llm"]
    model: str | None = None
    intent: str | None = None
    answer: str
    charts: list[dict[str, Any]]
    tools: list[ToolUse]
    follow_ups: list[str]
    notice: str | None = None


class SuggestionsResponse(SessionContext):
    suggestions: list[str]
    assistant: dict[str, Any]


class AIStatus(Model):
    enabled: bool
    provider: str | None = None
    model: str | None = None
    fallback: str = "rules"
