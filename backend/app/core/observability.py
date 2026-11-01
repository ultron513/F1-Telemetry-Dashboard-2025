"""Tracing (OpenTelemetry) and request metrics.

* Tracing is off unless ``OTEL_EXPORTER_OTLP_ENDPOINT`` is set; then every
  request, session load and background job becomes a span exported over
  OTLP/HTTP (Jaeger, Grafana Tempo, Honeycomb, …).
* Metrics are always on and cost almost nothing: a per-route counter and a
  bounded latency reservoir, served as JSON (``/api/v1/status``) and in
  Prometheus text format (``/metrics``).
"""

from __future__ import annotations

import contextlib
import logging
import os
import threading
import time
from collections import deque
from collections.abc import Iterator
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings

log = logging.getLogger("pitwall.observability")
STARTED = time.time()
RESERVOIR = 2048  # latency samples kept per route

_tracer = None


def setup_tracing(app: Any = None, service_suffix: str = "api") -> bool:
    """Configure OTLP export if an endpoint is configured. Returns True when enabled."""
    global _tracer
    if not os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return False
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:  # pragma: no cover - optional dependency
        log.warning("OpenTelemetry packages are not installed; tracing disabled")
        return False
    name = os.getenv("OTEL_SERVICE_NAME", f"pitwall-{service_suffix}")
    provider = TracerProvider(
        resource=Resource.create({"service.name": name, "service.version": settings.version})
    )
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer("pitwall")
    if app is not None:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app, excluded_urls="metrics,api/v1/health")
    log.info("Tracing to %s as %s", os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"), name)
    return True


@contextlib.contextmanager
def span(name: str, **attrs: Any) -> Iterator[None]:
    """A tracing span when tracing is on; free otherwise."""
    if _tracer is None:
        yield
        return
    with _tracer.start_as_current_span(name) as s:
        for k, v in attrs.items():
            s.set_attribute(k, v)
        yield


def tracing_enabled() -> bool:
    return _tracer is not None


class RouteStats:
    __slots__ = ("count", "errors", "latencies", "total")

    def __init__(self) -> None:
        self.count = 0
        self.errors = 0
        self.total = 0.0
        self.latencies: deque[float] = deque(maxlen=RESERVOIR)


class Metrics:
    def __init__(self) -> None:
        self.routes: dict[tuple[str, str], RouteStats] = {}
        self.status: dict[int, int] = {}
        self.lock = threading.Lock()

    def record(self, method: str, route: str, status: int, seconds: float) -> None:
        with self.lock:
            s = self.routes.setdefault((method, route), RouteStats())
            s.count += 1
            s.total += seconds
            s.latencies.append(seconds)
            if status >= 500:
                s.errors += 1
            self.status[status] = self.status.get(status, 0) + 1

    def snapshot(self) -> list[dict[str, Any]]:
        with self.lock:
            items = [
                (k, s.count, s.errors, s.total, sorted(s.latencies)) for k, s in self.routes.items()
            ]
        out = []
        for (method, route), count, errors, total, lat in items:

            def pct(p: float, lat: list[float] = lat) -> float | None:
                if not lat:
                    return None
                return round(lat[min(len(lat) - 1, int(p * len(lat)))] * 1000, 1)

            out.append(
                {
                    "method": method,
                    "route": route,
                    "requests": count,
                    "errors": errors,
                    "mean_ms": round(total / count * 1000, 1) if count else None,
                    "p50_ms": pct(0.5),
                    "p95_ms": pct(0.95),
                    "p99_ms": pct(0.99),
                }
            )
        out.sort(key=lambda r: -r["requests"])
        return out

    def prometheus(self, extra: dict[str, float]) -> str:
        lines = [
            "# HELP pitwall_requests_total HTTP requests by route and method.",
            "# TYPE pitwall_requests_total counter",
        ]
        rows = self.snapshot()
        for r in rows:
            labels = f'method="{r["method"]}",route="{r["route"]}"'
            lines.append(f"pitwall_requests_total{{{labels}}} {r['requests']}")
        lines += [
            "# HELP pitwall_request_errors_total 5xx responses.",
            "# TYPE pitwall_request_errors_total counter",
        ]
        for r in rows:
            lines.append(
                f'pitwall_request_errors_total{{method="{r["method"]}",route="{r["route"]}"}} {r["errors"]}'
            )
        lines += [
            "# HELP pitwall_request_latency_ms Request latency quantiles.",
            "# TYPE pitwall_request_latency_ms summary",
        ]
        for r in rows:
            for q, key in (("0.5", "p50_ms"), ("0.95", "p95_ms"), ("0.99", "p99_ms")):
                if r[key] is not None:
                    lines.append(
                        f'pitwall_request_latency_ms{{route="{r["route"]}",quantile="{q}"}} {r[key]}'
                    )
        for name, value in extra.items():
            lines += [f"# TYPE pitwall_{name} gauge", f"pitwall_{name} {value}"]
        return "\n".join(lines) + "\n"


metrics = Metrics()


class MetricsMiddleware:
    """Pure ASGI middleware (no buffering, works with streaming and WebSockets)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            route = scope.get("route")
            # The route template, not the raw path, so cardinality stays small.
            template = getattr(route, "path", None) or "unmatched"
            metrics.record(
                scope.get("method", "GET"), template, status, time.perf_counter() - started
            )
