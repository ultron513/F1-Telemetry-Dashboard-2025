from pydantic import BaseModel


class Driver(BaseModel):
    code: str
    full_name: str
    team: str


class DriverListResponse(BaseModel):
    season: int
    event_name: str
    session_name: str
    total_drivers: int
    drivers: list[Driver]