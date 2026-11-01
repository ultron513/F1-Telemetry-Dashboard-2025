"""Jobs, status and metrics."""

from __future__ import annotations

import time

import pytest

from app.core.config import settings
from app.jobs import queue


@pytest.fixture()
def local_queue():
    old = queue._backend
    queue.set_backend(queue.LocalBackend())
    yield queue.backend()
    queue.set_backend(old)


def test_ingest_job_runs_in_process(client, race_base, local_queue):
    r = client.post(
        "/api/v1/jobs/ingest", json={"season": 2025, "round": 3, "sessions": ["R"], "warm": True}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["backend"] == "in-process" and body["queued"] == 1
    job_id = body["jobs"][0]["id"]
    for _ in range(300):
        job = client.get(f"/api/v1/jobs/{job_id}").json()
        if job["status"] in {"finished", "failed"}:
            break
        time.sleep(0.1)
    assert job["status"] == "finished", job
    assert job["result"]["session"] == "R" and "summary" in job["result"]["warmed"]
    listing = client.get("/api/v1/jobs").json()
    assert listing["backend"] == "in-process" and listing["jobs"][0]["id"] == job_id
    assert client.get("/api/v1/jobs/nope").status_code == 404


def test_ingest_validation_and_admin_token(client, local_queue):
    assert client.post("/api/v1/jobs/ingest", json={"season": 2017}).status_code == 422
    object.__setattr__(settings, "admin_token", "s3cret")
    try:
        r = client.post("/api/v1/jobs/ingest", json={"season": 2025, "round": 3, "sessions": ["R"]})
        assert r.status_code == 401
        r = client.post(
            "/api/v1/jobs/ingest",
            json={"season": 2025, "round": 3, "sessions": ["R"], "warm": False},
            headers={"X-Admin-Token": "s3cret"},
        )
        assert r.status_code == 200
    finally:
        object.__setattr__(settings, "admin_token", None)


def test_status_and_prometheus(client):
    client.get("/api/v1/health")
    body = client.get("/api/v1/status").json()
    assert body["requests"]["total"] >= 1
    assert any(r["route"].endswith("/health") for r in body["routes"])
    assert body["queue"]["backend"] in {"in-process", "redis"}
    text = client.get("/metrics").text
    assert "# TYPE pitwall_requests_total counter" in text
    assert "pitwall_uptime_seconds" in text
