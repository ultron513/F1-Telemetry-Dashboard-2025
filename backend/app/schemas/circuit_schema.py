from pydantic import BaseModel


class CircuitResponse(BaseModel):
    season: int
    event_name: str

    circuit_name: str
    location: str
    country: str

    round_number: int