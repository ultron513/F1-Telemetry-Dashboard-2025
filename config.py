from pathlib import Path

# Root directory of the project
PROJECT_ROOT = Path(__file__).resolve().parent

# Main folders
DATA_DIR = PROJECT_ROOT / "data"
CACHE_DIR = PROJECT_ROOT / "cache"
ASSETS_DIR = PROJECT_ROOT / "assets"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

# Data folders
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
TELEMETRY_DIR = DATA_DIR / "telemetry"
LAPS_DIR = DATA_DIR / "laps"
WEATHER_DIR = DATA_DIR / "weather"
TYRES_DIR = DATA_DIR / "tyres"
DRIVERS_DIR = DATA_DIR / "drivers"
TEAMS_DIR = DATA_DIR / "teams"
CIRCUITS_DIR = DATA_DIR / "circuits"
EXPORTS_DIR = DATA_DIR / "exports"

# Supported season
DEFAULT_SEASON = 2025