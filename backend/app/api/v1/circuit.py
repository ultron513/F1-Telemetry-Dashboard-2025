from fastapi import APIRouter

from app.schemas.circuit_schema import CircuitResponse
from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/circuit",
    tags=["Circuit"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=CircuitResponse
)
def get_circuit(
    event_name: str
):

    circuit = service.get_circuit(event_name)

    return CircuitResponse(
        season=2025,
        event_name=event_name,
        **circuit
    )