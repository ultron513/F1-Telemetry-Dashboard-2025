"""AI endpoints: session reports and "Ask the pit wall"."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.ai import agent, llm, report as report_svc
from app.api.deps import session_ref
from app.data.schedule import SessionRef
from app.schemas.ai import AIStatus, AskRequest, AskResponse, ReportResponse, SuggestionsResponse

router = APIRouter(tags=["AI"])
Ref = Annotated[SessionRef, Depends(session_ref)]
SESSION = "/sessions/{season}/{round}/{session}"


def _ctx(ref: SessionRef) -> dict:
    return {
        "season": ref.season,
        "round": ref.round,
        "session": {"code": ref.code, "name": ref.name, "kind": ref.kind},
    }


@router.get("/ai/status", response_model=AIStatus, summary="Is a language model configured?")
def status() -> dict:
    return llm.describe()


@router.get(
    f"{SESSION}/report",
    response_model=ReportResponse,
    summary="Automatic session report (headline, key moments, strategy, pace)",
)
def session_report(
    ref: Ref,
    narrate: Annotated[
        bool, Query(description="Let the language model rewrite the prose, if one is configured")
    ] = True,
) -> dict:
    return report_svc.report(ref, narrate)


@router.get(
    f"{SESSION}/ask/suggestions",
    response_model=SuggestionsResponse,
    summary="Starter questions for this session",
)
def suggestions(ref: Ref) -> dict:
    return {**_ctx(ref), "suggestions": agent.follow_ups(ref), "assistant": llm.describe()}


@router.post(
    f"{SESSION}/ask",
    response_model=AskResponse,
    summary="Ask the pit wall a question about this session",
)
def ask(ref: Ref, body: AskRequest) -> dict:
    history = [t.model_dump() for t in body.history]
    return {**_ctx(ref), "question": body.question, **agent.ask(ref, body.question, history)}
