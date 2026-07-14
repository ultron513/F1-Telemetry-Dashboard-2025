from pydantic import BaseModel


class Team(BaseModel):
    name: str


class TeamListResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    total_teams: int
    teams: list[Team]