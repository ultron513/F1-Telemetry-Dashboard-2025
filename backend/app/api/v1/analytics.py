from fastapi import APIRouter

from app.services.season_service import SeasonService

from app.schemas.analytics_schemas import *

router = APIRouter(
    prefix="/api/v1",
    tags=["Advanced Analytics"]
)

service = SeasonService()


# ==========================================================
# STEP 50 — RACE CONTROL
# ==========================================================

@router.get(
    "/race-control",
    response_model=RaceControlResponse
)
def race_control(
    event_name: str,
    session_name: str
):

    return RaceControlResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        messages=[
            RaceControlMessage(**x)
            for x in service.get_race_control_messages(
                event_name,
                session_name
            )
        ]
    )


# ==========================================================
# STEP 53 — TRACK STATUS
# ==========================================================

@router.get(
    "/track-status",
    response_model=TrackStatusResponse
)
def track_status(
    event_name: str,
    session_name: str
):

    return TrackStatusResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        statuses=[
            TrackStatusPoint(**x)
            for x in service.get_track_status(
                event_name,
                session_name
            )
        ]
    )


# ==========================================================
# STEP 55 — WEATHER HISTORY
# ==========================================================

@router.get(
    "/weather-history",
    response_model=WeatherHistoryResponse
)
def weather_history(
    event_name: str,
    session_name: str
):

    return WeatherHistoryResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        history=[
            WeatherHistoryPoint(**x)
            for x in service.get_weather_history(
                event_name,
                session_name
            )
        ]
    )


# ==========================================================
# STEP 56 — SECTOR ANALYSIS
# ==========================================================

@router.get(
    "/sector-analysis",
    response_model=SectorAnalysisResponse
)
def sector_analysis(
    event_name: str,
    session_name: str
):

    return SectorAnalysisResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        sectors=[
            SectorAnalysis(**x)
            for x in service.get_sector_analysis(
                event_name,
                session_name
            )
        ]
    )


# ==========================================================
# STEP 58 — SPEED TRAPS
# ==========================================================

@router.get(
    "/speed-traps",
    response_model=SpeedTrapResponse
)
def speed_traps(
    event_name: str,
    session_name: str
):

    return SpeedTrapResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        speed_traps=[
            SpeedTrapEntry(**x)
            for x in service.get_speed_traps(
                event_name,
                session_name
            )
        ]
    )


# ==========================================================
# STEP 64 — DRIVER CONSISTENCY
# ==========================================================

@router.get(
    "/driver-consistency",
    response_model=DriverConsistencyResponse
)
def driver_consistency(
    event_name: str,
    session_name: str,
    driver: str
):

    return DriverConsistencyResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        consistency=[
            DriverConsistencyPoint(**x)
            for x in service.get_driver_consistency(
                event_name,
                session_name,
                driver
            )
        ]
    )


# ==========================================================
# STEP 65 — RACE PACE
# ==========================================================

@router.get(
    "/race-pace",
    response_model=RacePaceResponse
)
def race_pace(
    event_name: str
):

    return RacePaceResponse(
        season=2025,
        event_name=event_name,
        pace=[
            RacePacePoint(**x)
            for x in service.get_race_pace(
                event_name
            )
        ]
    )


# ==========================================================
# STEP 66 — QUALIFYING PACE
# ==========================================================

@router.get(
    "/qualifying-pace",
    response_model=QualifyingPaceResponse
)
def qualifying_pace(
    event_name: str
):

    return QualifyingPaceResponse(
        season=2025,
        event_name=event_name,
        pace=[
            QualifyingPacePoint(**x)
            for x in service.get_qualifying_pace(
                event_name
            )
        ]
    )


# ==========================================================
# STEP 67 — TELEMETRY STATISTICS
# ==========================================================

@router.get(
    "/telemetry-statistics",
    response_model=TelemetryStatisticsResponse
)
def telemetry_statistics(
    event_name: str,
    session_name: str,
    driver: str,
    lap_number: int
):

    return TelemetryStatisticsResponse(
        season=2025,
        event_name=event_name,
        session_name=session_name,
        driver=driver,
        lap_number=lap_number,
        **service.get_telemetry_statistics(
            event_name,
            session_name,
            driver,
            lap_number
        )
    )