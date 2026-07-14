export const API = {
  BASE_URL: "http://127.0.0.1:8000/api/v1",

  SEASONS: "/seasons/",
  RACES: "/races/",
  SESSIONS: "/sessions/",

  DRIVERS: "/drivers/",
  TEAMS: "/teams/",

  LAPS: "/laps/",
  TELEMETRY: "/telemetry/",
  DRIVER_POSITION: "/driver-position/",
  DRIVER_CAR_DATA: "/driver-car-data/",

  TRACK_MAP: "/track-map/",
  WEATHER: "/weather/",
  CIRCUIT: "/circuit/",

  LAP_SUMMARY: "/lap-summary/",
  LAP_DELTA: "/lap-delta/",
  COMPARE_LAPS: "/compare-laps/",

  FASTEST_LAP: "/fastest-lap/",

  DRIVER_STANDINGS: "/driver-standings/",
  CONSTRUCTOR_STANDINGS: "/constructor-standings/",
  SESSION_RESULTS: "/session-results/",

  TYRE_STRATEGY: "/tyre-strategy/",
  PIT_STOPS: "/pit-stops/",

  RACE_CONTROL: "/race-control/",
  TRACK_STATUS: "/track-status/",
  WEATHER_HISTORY: "/weather-history/",
  SECTOR_ANALYSIS: "/sector-analysis/",
  SPEED_TRAPS: "/speed-traps/",
  DRIVER_CONSISTENCY: "/driver-consistency/",
  RACE_PACE: "/race-pace/",
  QUALIFYING_PACE: "/qualifying-pace/",
  TELEMETRY_STATISTICS: "/telemetry-statistics/",
} as const;