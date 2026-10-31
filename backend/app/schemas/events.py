from __future__ import annotations

from app.schemas.common import Model


class SessionSlot(Model):
    code: str
    name: str
    kind: str
    start_utc: str | None = None


class Event(Model):
    round: int
    name: str
    official_name: str
    country: str
    location: str
    date: str | None = None
    format: str
    status: str
    sessions: list[SessionSlot]


class SeasonsResponse(Model):
    seasons: list[int]
    default_season: int


class EventsResponse(Model):
    season: int
    events: list[Event]
    next_event: Event | None = None
    last_completed: Event | None = None
