from fastapi import APIRouter

from app.services.season_service import SeasonService

router = APIRouter()

service = SeasonService()


@router.get("/sector-comparison")
def sector_comparison(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_sector_comparison(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/corner-analysis")
def corner_analysis(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_corner_analysis(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/top-speed-analysis")
def top_speed_analysis(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_top_speed_analysis(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/acceleration-analysis")
def acceleration_analysis(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_acceleration_analysis(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/braking-analysis")
def braking_analysis(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_braking_analysis(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/drs-analysis")
def drs_analysis(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_drs_analysis(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/consistency-analysis")
def consistency_analysis(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
):
    return service.get_consistency_analysis(
        event_name,
        session_name,
        driver1,
        driver2,
    )

@router.get("/performance-summary")
def performance_summary(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_performance_summary(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )

@router.get("/driver-performance-score")
def driver_performance_score(
    event_name: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: int,
):
    return service.get_driver_performance_score(
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    )