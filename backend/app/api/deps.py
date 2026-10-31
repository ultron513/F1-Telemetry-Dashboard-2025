from __future__ import annotations

from typing import Annotated

import pandas as pd
from fastapi import Path, Request

from app.core.serialize import now_utc
from app.data.schedule import SessionRef, resolve_session, session_start


def session_ref(
    request: Request,
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
    ref = resolve_session(season, round, session)
    # Data for a session that started recently may still change (late
    # penalties, archive updates), so the HTTP cache keeps it short-lived.
    start = session_start(ref)
    request.state.session_recent = start is None or pd.Timestamp(now_utc()) - start < pd.Timedelta(
        hours=24
    )
    return ref


def norm_driver(code: str) -> str:
    return code.strip().upper()


def norm_lap(lap: str | None) -> str:
    if lap is None:
        return "fastest"
    lap = lap.strip().lower()
    return lap or "fastest"
