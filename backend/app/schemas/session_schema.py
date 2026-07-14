from pydantic import BaseModel


class Session(BaseModel):
    name: str


class SessionListResponse(BaseModel):
    season: int
    event_name: str
    sessions: list[Session]