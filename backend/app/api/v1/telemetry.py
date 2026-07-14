from fastapi import APIRouter

from app.schemas.telemetry_schema import (
    TelemetryPoint,
    TelemetryResponse
)

from app.services.season_service import SeasonService

router = APIRouter(
    prefix="/api/v1/telemetry",
    tags=["Telemetry"]
)

service = SeasonService()


@router.get(
    "/",
    response_model=TelemetryResponse
)
def get_telemetry(
    event_name: str,
    session_name: str,
    driver: str,
    lap_number: int
):

    df = service.get_telemetry(
        event_name,
        session_name,
        driver,
        lap_number
    )

    telemetry = []

    for _, row in df.iterrows():

        telemetry.append(
            TelemetryPoint(
                distance=float(row["Distance"]),
                speed=float(row["Speed"]),
                throttle=float(row["Throttle"]),
                brake=bool(row["Brake"]),
                rpm=int(row["RPM"]),
                gear=int(row["nGear"]),
                drs=int(row["DRS"])
            )
        )

    return TelemetryResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        lap_number=lap_number,
        total_samples=len(telemetry),
        telemetry=telemetry
    )