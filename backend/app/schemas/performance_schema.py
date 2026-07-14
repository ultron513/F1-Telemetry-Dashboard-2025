from pydantic import BaseModel


class SectorComparison(BaseModel):
    driver: str
    sector1: float
    sector2: float
    sector3: float
    lap_time: float