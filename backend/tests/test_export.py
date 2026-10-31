"""The static exporter renders a cached race into the file layout the website reads."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))


def test_export_cached_race(tmp_path, race_base):
    from export_static import Exporter

    exporter = Exporter(tmp_path, force=True, keep_cache=True, upload=False)
    assert exporter.export_session(2025, 3, "R") is None
    root = tmp_path / "v1" / "sessions" / "2025" / "3" / "R"
    summary = json.loads((root / "summary.json").read_text())
    assert summary["highlights"]["winner"] == "VER"
    for leaf in ("circuit", "strategy", "race-control", "replay", "ratings"):
        assert (root / f"{leaf}.json").exists(), leaf
    telemetry = json.loads((root / "telemetry" / "NOR.json").read_text())
    assert telemetry["lap"]["lap"] is not None
    assert len(list((root / "laps").glob("*.json"))) == 20


def test_unpublished_session_reports_reason(tmp_path, race_base):
    from export_static import Exporter

    exporter = Exporter(tmp_path, force=True, keep_cache=True, upload=False)
    reason = exporter.export_session(2025, 3, "FP1")
    if reason is None:
        pytest.skip("FP1 happens to be cached")
    assert "published" in reason or "loaded" in reason
