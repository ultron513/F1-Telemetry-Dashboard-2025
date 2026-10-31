"""Test configuration.

Tests run against the FastF1 cache in the repository's ``cache/`` folder in
offline mode, so they are deterministic and need no network. Sessions that
are not cached are skipped rather than failed.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("F1_OFFLINE", "1")
os.environ.setdefault("F1_CACHE_DIR", str(REPO / "cache"))

CACHED_RACE = (2025, 3, "R")  # Japanese GP 2025
CACHED_RACE_DIR = REPO / "cache" / "2025" / "2025-04-06_Japanese_Grand_Prix" / "2025-04-06_Race"


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(scope="session")
def race_base():
    if not CACHED_RACE_DIR.exists():
        pytest.skip("Japanese GP 2025 race is not in the local FastF1 cache")
    season, rnd, code = CACHED_RACE
    return f"/api/v1/sessions/{season}/{rnd}/{code}"
