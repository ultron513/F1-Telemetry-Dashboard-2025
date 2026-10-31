"""Season calendars and session identifier resolution."""

from __future__ import annotations

from dataclasses import dataclass

import fastf1
import pandas as pd

from app.core.config import settings
from app.core.errors import DataUnavailableError, InvalidParameterError, NotFoundError
from app.core.memo import memoize
from app.core.serialize import is_missing, iso_utc, now_utc, text

# Schedule session names -> FastF1 identifiers (stable, URL friendly).
SESSION_CODES: dict[str, str] = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SS",
    "Sprint": "S",
    "Race": "R",
}
SESSION_NAMES: dict[str, str] = {code: name for name, code in SESSION_CODES.items()}

RACE_LIKE = {"R", "S"}
QUALI_LIKE = {"Q", "SQ", "SS"}
PRACTICE = {"FP1", "FP2", "FP3"}


def session_kind(code: str) -> str:
    if code in RACE_LIKE:
        return "race"
    if code in QUALI_LIKE:
        return "qualifying"
    return "practice"


@dataclass(frozen=True)
class SessionRef:
    season: int
    round: int
    code: str

    @property
    def name(self) -> str:
        return SESSION_NAMES.get(self.code, self.code)

    @property
    def kind(self) -> str:
        return session_kind(self.code)

    @property
    def key(self) -> tuple[int, int, str]:
        return (self.season, self.round, self.code)


def validate_season(season: int) -> int:
    if season not in settings.seasons:
        raise InvalidParameterError(
            f"Season {season} is not supported.",
            hint=f"Supported seasons: {', '.join(map(str, settings.seasons))}",
        )
    return season


@memoize(maxsize=16, ttl=6 * 3600)
def load_schedule(season: int) -> pd.DataFrame:
    validate_season(season)
    try:
        schedule = fastf1.get_event_schedule(season, include_testing=False)
    except Exception as exc:  # network / backend failures
        raise DataUnavailableError(
            f"Could not load the {season} calendar.",
            hint="The timing backend may be unreachable; try again shortly.",
        ) from exc
    if schedule is None or schedule.empty:
        raise DataUnavailableError(f"No calendar is available for {season}.")
    return schedule.reset_index(drop=True)


def _event_sessions(row: pd.Series) -> list[dict]:
    sessions = []
    for i in range(1, 6):
        name = text(row.get(f"Session{i}"))
        if not name:
            continue
        code = SESSION_CODES.get(name)
        if code is None:
            continue
        sessions.append(
            {
                "code": code,
                "name": name,
                "kind": session_kind(code),
                "start_utc": iso_utc(row.get(f"Session{i}DateUtc")),
            }
        )
    return sessions


def _event_status(sessions: list[dict]) -> str:
    now = pd.Timestamp(now_utc())
    starts = [pd.Timestamp(s["start_utc"]) for s in sessions if s["start_utc"]]
    if not starts:
        return "upcoming"
    first, last = min(starts), max(starts)
    # A race is "completed" a few hours after the final session start.
    if now > last + pd.Timedelta(hours=3):
        return "completed"
    if now >= first:
        return "live"
    return "upcoming"


def event_to_dict(row: pd.Series) -> dict:
    sessions = _event_sessions(row)
    return {
        "round": int(row["RoundNumber"]),
        "name": text(row.get("EventName"), ""),
        "official_name": text(row.get("OfficialEventName"), ""),
        "country": text(row.get("Country"), ""),
        "location": text(row.get("Location"), ""),
        "date": iso_utc(row.get("EventDate")),
        "format": text(row.get("EventFormat"), "conventional"),
        "status": _event_status(sessions),
        "sessions": sessions,
    }


@memoize(maxsize=16, ttl=1800)
def list_events(season: int) -> list[dict]:
    schedule = load_schedule(season)
    return [event_to_dict(row) for _, row in schedule.iterrows()]


def get_event(season: int, round_number: int) -> dict:
    for event in list_events(season):
        if event["round"] == round_number:
            return event
    raise NotFoundError(f"Round {round_number} does not exist in {season}.")


def resolve_session(season: int, round_number: int, code: str) -> SessionRef:
    validate_season(season)
    code = code.upper()
    if code not in SESSION_NAMES:
        raise InvalidParameterError(
            f"Unknown session '{code}'.",
            hint=f"Use one of: {', '.join(SESSION_NAMES)}",
        )
    event = get_event(season, round_number)
    available = {s["code"] for s in event["sessions"]}
    if code not in available:
        raise NotFoundError(
            f"{event['name']} {season} has no {SESSION_NAMES[code]} session.",
            hint=f"Available: {', '.join(sorted(available))}",
        )
    return SessionRef(season=season, round=round_number, code=code)


def session_start(ref: SessionRef) -> pd.Timestamp | None:
    event = get_event(ref.season, ref.round)
    for s in event["sessions"]:
        if s["code"] == ref.code and s["start_utc"]:
            return pd.Timestamp(s["start_utc"])
    return None


def is_session_in_future(ref: SessionRef) -> bool:
    start = session_start(ref)
    if start is None or is_missing(start):
        return False
    return pd.Timestamp(now_utc()) < start


@memoize(maxsize=1, ttl=3600)
def current_season() -> int:
    """Newest supported season with at least one completed event."""
    if settings.default_season_pinned:
        return settings.default_season
    for season in sorted(settings.seasons, reverse=True):
        try:
            if any(e["status"] == "completed" for e in list_events(season)):
                return season
        except Exception:
            continue
    return settings.default_season
