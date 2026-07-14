from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.v1.seasons import router as seasons_router
from app.api.v1.races import router as races_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.drivers import router as drivers_router
from app.api.v1.teams import router as teams_router
from app.api.v1.laps import router as laps_router
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.lap_summary import router as lap_summary_router
from app.api.v1.compare_laps import router as compare_laps_router
from app.api.v1.circuit import router as circuit_router
from app.api.v1.weather import router as weather_router
from app.api.v1.track_map import router as track_map_router
from app.api.v1.driver_car_data import router as driver_car_data_router
from app.api.v1.lap_delta import router as lap_delta_router
from app.api.v1.driver_position import router as driver_position_router
from app.api.v1.fastest_lap import router as fastest_lap_router
from app.api.v1.session_results import router as session_results_router
from app.api.v1.driver_standings import router as driver_standings_router
from app.api.v1.constructor_standings import router as constructor_standings_router
from app.api.v1.tyre_strategy import router as tyre_strategy_router
from app.api.v1.pit_stops import router as pit_stops_router
from app.api.v1.analytics import router as analytics_router
from app.api.performance import router as performance_router
from app.api import lap_delta
from app.api import standings
from app.api import constructors
from app.api.v1.race_control import router as race_control_router
from app.api.v1.pit_stops import router as pit_stops_router
from app.api.v1.tyre_degradation import (
    router as tyre_degradation_router,
)
app = FastAPI(
    title="F1 Engineering Analytics API",
    description="Backend API for the F1 Telemetry Analysis Platform",
    version="1.0.0"
)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(seasons_router)
app.include_router(races_router)
app.include_router(sessions_router)
app.include_router(drivers_router)
app.include_router(teams_router)
app.include_router(laps_router)
app.include_router(telemetry_router)
app.include_router(lap_summary_router)
app.include_router(compare_laps_router)
app.include_router(circuit_router)
app.include_router(weather_router)
app.include_router(track_map_router)
app.include_router(driver_car_data_router)
app.include_router(lap_delta_router)
app.include_router(driver_position_router)
app.include_router(fastest_lap_router)
app.include_router(session_results_router)
app.include_router(driver_standings_router)
app.include_router(constructor_standings_router)
app.include_router(tyre_strategy_router)
app.include_router(pit_stops_router)
app.include_router(analytics_router)
app.include_router(lap_delta.router, prefix="/api/v1")
app.include_router(
    performance_router,
    prefix="/api/v1",
)
app.include_router(
    standings.router,
    prefix="/api/v1",
)

app.include_router(
    constructors.router,
    prefix="/api/v1",
)
app.include_router(race_control_router)
app.include_router(pit_stops_router)
app.include_router(tyre_degradation_router)
@app.get("/")
def root():

    return {
        "message": "F1 Engineering Analytics API is running!"
    }