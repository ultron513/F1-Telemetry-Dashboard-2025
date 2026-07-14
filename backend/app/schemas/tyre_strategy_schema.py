from pydantic import BaseModel
from typing import List


class TyreStint(BaseModel):
    driver: str
    stint: int
    compound: str
    laps: int
    fresh_tyre: bool


class TyreStrategyResponse(BaseModel):
    season: int
    event_name: str

    stints: List[TyreStint]