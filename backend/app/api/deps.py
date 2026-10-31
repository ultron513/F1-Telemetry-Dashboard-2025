from __future__ import annotations

from typing import Annotated

from fastapi import Path

from app.data.schedule import SessionRef, resolve_session


def session_ref(
    season: Annotated[int, Path(ge=2018, le=2100, description="Championship year")],
    round: Annotated[int, Path(ge=1, le=30, description="Round number in the calendar")],
    session: Annotated[
        str,
        Path(
            pattern=r"^(?i:FP1|FP2|FP3|Q|SQ|SS|S|R)$",
            description="FastF1 session identifier (FP1, FP2, FP3, Q, SQ, SS, S, R)",
        ),
    ],
) -> SessionRef:
    return resolve_session(season, round, session)


def norm_driver(code: str) -> str:
    return code.strip().upper()


def norm_lap(lap: str | None) -> str:
    if lap is None:
        return "fastest"
    lap = lap.strip().lower()
    return lap or "fastest"
