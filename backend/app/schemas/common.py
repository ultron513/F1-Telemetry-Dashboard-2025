from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class Model(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class ErrorBody(Model):
    code: str
    message: str
    hint: str | None = None


class ErrorResponse(Model):
    error: ErrorBody


class DriverInfo(Model):
    code: str
    number: str
    first_name: str = ""
    last_name: str = ""
    full_name: str
    broadcast_name: str
    team: str
    team_color: str | None = None
    country_code: str | None = None
    position: int | None = None


class SessionInfo(Model):
    code: str
    name: str
    kind: str


class SessionContext(Model):
    season: int
    round: int
    session: SessionInfo
