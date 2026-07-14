from pydantic import BaseModel


class SeasonsResponse(BaseModel):
    available_seasons: list[int]
    default_season: int