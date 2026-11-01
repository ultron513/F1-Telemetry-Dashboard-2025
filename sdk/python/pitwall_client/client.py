"""Synchronous and asynchronous clients mirroring the API's resources."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass
from typing import Any

import httpx

DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=10.0)  # first loads of a session can be slow


class ApiError(Exception):
    """An error response from the API (``{"error": {code, message, hint}}``)."""

    def __init__(self, status: int, code: str, message: str, hint: str | None = None):
        super().__init__(f"{status} {code}: {message}" + (f" ({hint})" if hint else ""))
        self.status = status
        self.code = code
        self.message = message
        self.hint = hint


def _raise_for(resp: httpx.Response) -> None:
    if resp.is_success:
        return
    try:
        body = resp.json()
    except ValueError:
        body = {}
    err = body.get("error") if isinstance(body, dict) else None
    if err:
        raise ApiError(
            resp.status_code, err.get("code", "error"), err.get("message", ""), err.get("hint")
        )
    detail = body.get("detail") if isinstance(body, dict) else None
    if isinstance(detail, list):
        raise ApiError(
            resp.status_code, "invalid_parameter", "; ".join(d.get("msg", "") for d in detail)
        )
    raise ApiError(resp.status_code, "http_error", resp.text[:200])


def _plan(stints: str | Iterable[tuple[str, int]]) -> str:
    """Accept ``"M:20,H:33"`` or ``[("M", 20), ("H", 33)]``."""
    if isinstance(stints, str):
        return stints
    return ",".join(f"{c[0].upper()}:{n}" for c, n in stints)


@dataclass(frozen=True)
class SessionClient:
    """Everything about one session: ``pw.session(2025, 3, "R")``."""

    _pw: PitWall
    season: int
    round: int
    code: str

    def _get(self, leaf: str, **params: Any) -> dict[str, Any]:
        return self._pw.get(f"/sessions/{self.season}/{self.round}/{self.code}/{leaf}", **params)

    # Timing
    def summary(self) -> dict[str, Any]:
        return self._get("summary")

    def results(self) -> dict[str, Any]:
        return self._get("results")

    def drivers(self) -> dict[str, Any]:
        return self._get("drivers")

    def laps(self, driver: str) -> dict[str, Any]:
        return self._get("laps", driver=driver)

    def pace(self) -> dict[str, Any]:
        return self._get("pace")

    # Telemetry
    def telemetry(self, driver: str, lap: int | str = "fastest") -> dict[str, Any]:
        return self._get("telemetry", driver=driver, lap=lap)

    def compare(
        self, a: str, b: str, lap_a: int | str = "fastest", lap_b: int | str = "fastest"
    ) -> dict[str, Any]:
        return self._get("compare", driver_a=a, driver_b=b, lap_a=lap_a, lap_b=lap_b)

    def circuit(self) -> dict[str, Any]:
        return self._get("circuit")

    def circuit_3d(self) -> dict[str, Any]:
        return self._get("circuit/3d")

    # Strategy
    def strategy(self) -> dict[str, Any]:
        return self._get("strategy")

    def race_trace(self) -> dict[str, Any]:
        return self._get("race-trace")

    def degradation(self, driver: str) -> dict[str, Any]:
        return self._get("degradation", driver=driver)

    # Simulator
    def tyre_model(self, driver: str | None = None) -> dict[str, Any]:
        return self._get("simulator/model", driver=driver)

    def simulate(
        self,
        driver: str,
        plan: str | Iterable[tuple[str, int]],
        runs: int = 400,
        safety_cars: float | None = None,
        vscs: float | None = None,
    ) -> dict[str, Any]:
        return self._get(
            "simulator/simulate",
            driver=driver,
            plan=_plan(plan),
            runs=runs,
            sc=safety_cars,
            vsc=vscs,
        )

    def optimise(self, driver: str, conditions: str = "green") -> dict[str, Any]:
        return self._get("simulator/optimise", driver=driver, conditions=conditions)

    def undercut(
        self, attacker: str, defender: str, lap: int, compound: str | None = None
    ) -> dict[str, Any]:
        return self._get(
            "simulator/undercut", attacker=attacker, defender=defender, lap=lap, compound=compound
        )

    # Analysis
    def style(self, *drivers: str) -> dict[str, Any]:
        return self._get("analysis/style", drivers=",".join(drivers))

    def ideal_lap(self, driver: str) -> dict[str, Any]:
        return self._get("analysis/ideal-lap", driver=driver)

    def cars(self) -> dict[str, Any]:
        return self._get("analysis/cars")

    def tyre_management(self) -> dict[str, Any]:
        return self._get("analysis/tyre-management")

    # Everything else
    def race_control(self) -> dict[str, Any]:
        return self._get("race-control")

    def weather(self) -> dict[str, Any]:
        return self._get("weather")

    def ratings(self) -> dict[str, Any]:
        return self._get("ratings")

    def replay(self, step: float = 1.0) -> dict[str, Any]:
        return self._get("replay", step=step)

    def onboard(self, driver: str, step: float = 0.5) -> dict[str, Any]:
        return self._get("replay/onboard", driver=driver, step=step)

    def laps_frame(self, driver: str):
        """The driver's lap table as a pandas DataFrame (``pip install pitwall-client[pandas]``)."""
        import pandas as pd

        return pd.DataFrame(self.laps(driver)["laps"])


class PitWall:
    """Synchronous client. Use as a context manager to close the connection pool."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        *,
        timeout: httpx.Timeout | float = DEFAULT_TIMEOUT,
        admin_token: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        headers = {"Accept": "application/json", "User-Agent": "pitwall-client/0.1"}
        if admin_token:
            headers["X-Admin-Token"] = admin_token
        self._http = httpx.Client(
            base_url=f"{self.base_url}/api/v1",
            timeout=timeout,
            headers=headers,
            transport=transport,
        )

    def __enter__(self) -> PitWall:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def get(self, path: str, **params: Any) -> dict[str, Any]:
        clean = {k: v for k, v in params.items() if v is not None}
        resp = self._http.get(path, params=clean)
        _raise_for(resp)
        return resp.json()

    def post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        resp = self._http.post(path, json=body)
        _raise_for(resp)
        return resp.json()

    # Meta & calendar
    def health(self) -> dict[str, Any]:
        return self.get("/health")

    def status(self) -> dict[str, Any]:
        return self.get("/status")

    def seasons(self) -> list[int]:
        return self.get("/seasons")["seasons"]

    def events(self, season: int) -> list[dict[str, Any]]:
        return self.get(f"/seasons/{season}/events")["events"]

    def standings(self, season: int, round: int | None = None) -> dict[str, Any]:
        return self.get(f"/seasons/{season}/standings", round=round)

    def teammates(self, season: int) -> dict[str, Any]:
        return self.get(f"/seasons/{season}/teammates")

    def session(self, season: int, round: int, code: str = "R") -> SessionClient:
        return SessionClient(self, season, round, code.upper())

    # History
    def champions(self) -> dict[str, Any]:
        return self.get("/history/champions")

    def find_drivers(self, search: str) -> list[dict[str, Any]]:
        return self.get("/history/drivers", search=search)["drivers"]

    def career(self, driver_id: str) -> dict[str, Any]:
        return self.get(f"/history/drivers/{driver_id}")

    def circuit_history(self, circuit_id: str) -> dict[str, Any]:
        return self.get(f"/history/circuits/{circuit_id}")

    # Jobs
    def ingest(
        self,
        season: int,
        round: int | None = None,
        sessions: list[str] | None = None,
        warm: bool = True,
    ) -> dict[str, Any]:
        return self.post(
            "/jobs/ingest", {"season": season, "round": round, "sessions": sessions, "warm": warm}
        )

    def job(self, job_id: str) -> dict[str, Any]:
        return self.get(f"/jobs/{job_id}")


class AsyncPitWall:
    """Async client with the live-timing stream."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        *,
        timeout: httpx.Timeout | float = DEFAULT_TIMEOUT,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self._http = httpx.AsyncClient(
            base_url=f"{self.base_url}/api/v1",
            timeout=timeout,
            headers={"Accept": "application/json"},
            transport=transport,
        )

    async def __aenter__(self) -> AsyncPitWall:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._http.aclose()

    async def get(self, path: str, **params: Any) -> dict[str, Any]:
        resp = await self._http.get(path, params={k: v for k, v in params.items() if v is not None})
        _raise_for(resp)
        return resp.json()

    async def live(
        self,
        season: int | None = None,
        round: int | None = None,
        session: str | None = None,
        *,
        speed: float = 1.0,
        start: float = 0.0,
    ) -> AsyncIterator[dict[str, Any]]:
        """Live snapshots. With a session: an archived replay at ``speed``; without: the real feed.

        Requires ``pip install pitwall-client[live]``.
        """
        import websockets

        ws_base = self.base_url.replace("http", "ws", 1)
        if season is None:
            url = f"{ws_base}/api/v1/live/ws?mode=live"
        else:
            url = f"{ws_base}/api/v1/live/ws?mode=archive&season={season}&round={round}&session={session}&speed={speed}&start={start}"
        async with websockets.connect(url, max_size=2**24) as ws:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("type") == "error":
                    raise ApiError(0, "live_error", msg.get("message", ""), msg.get("hint"))
                if msg.get("type") == "end":
                    return
                if msg.get("type") == "snapshot":
                    yield msg
