"""A small job-queue facade.

With ``REDIS_URL`` set, jobs go to Redis through RQ and run in separate
worker processes (``python -m app.jobs.worker``) — heavy downloads never
block the API. Without it (local development), the same jobs run on a
background thread pool inside the API process, so ``uvicorn`` alone still
works.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Protocol

from app.core.config import settings

log = logging.getLogger("pitwall.jobs")
QUEUE_NAME = "pitwall"


class Backend(Protocol):
    name: str

    def enqueue(self, fn: str, *args: Any, description: str = "") -> str: ...

    def get(self, job_id: str) -> dict[str, Any] | None: ...

    def recent(self, limit: int = 30) -> list[dict[str, Any]]: ...

    def stats(self) -> dict[str, Any]: ...


def _resolve(fn: str):
    from app.jobs import tasks

    return getattr(tasks, fn)


class LocalBackend:
    """Thread-pool queue inside the API process."""

    name = "in-process"

    def __init__(self, workers: int = 1, keep: int = 200):
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="pitwall-job")
        self._jobs: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._lock = threading.Lock()
        self._keep = keep

    def enqueue(self, fn: str, *args: Any, description: str = "") -> str:
        job_id = uuid.uuid4().hex[:12]
        job = {
            "id": job_id,
            "function": fn,
            "args": list(args),
            "description": description or fn,
            "status": "queued",
            "enqueued_at": time.time(),
            "started_at": None,
            "ended_at": None,
            "result": None,
            "error": None,
        }
        with self._lock:
            self._jobs[job_id] = job
            while len(self._jobs) > self._keep:
                self._jobs.popitem(last=False)

        def run() -> None:
            job["status"] = "started"
            job["started_at"] = time.time()
            try:
                job["result"] = _resolve(fn)(*args)
                job["status"] = "finished"
            except Exception as exc:
                log.exception("Job %s failed", job_id)
                job["status"] = "failed"
                job["error"] = str(exc)
            finally:
                job["ended_at"] = time.time()

        self._pool.submit(run)
        return job_id

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def recent(self, limit: int = 30) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(j) for j in reversed(list(self._jobs.values()))][:limit]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            jobs = list(self._jobs.values())
        counts: dict[str, int] = {}
        for j in jobs:
            counts[j["status"]] = counts.get(j["status"], 0) + 1
        return {"backend": self.name, "workers": self._pool._max_workers, "counts": counts}


class RedisBackend:
    """RQ on Redis; workers run ``python -m app.jobs.worker``."""

    name = "redis"

    def __init__(self, url: str):
        from redis import Redis
        from rq import Queue

        self.redis = Redis.from_url(url)
        self.redis.ping()
        self.queue = Queue(QUEUE_NAME, connection=self.redis, default_timeout=60 * 30)

    def enqueue(self, fn: str, *args: Any, description: str = "") -> str:
        job = self.queue.enqueue(
            f"app.jobs.tasks.{fn}",
            *args,
            description=description or fn,
            result_ttl=7 * 24 * 3600,
            failure_ttl=7 * 24 * 3600,
        )
        return job.id

    @staticmethod
    def _dump(job) -> dict[str, Any]:
        def ts(v):
            return v.timestamp() if v else None

        status = job.get_status(refresh=False)
        result = None
        error = None
        if status == "finished":
            result = job.return_value()
        elif status == "failed":
            error = (
                (job.latest_result().exc_string or "").strip().splitlines()[-1]
                if job.latest_result()
                else "failed"
            )
        return {
            "id": job.id,
            "function": (job.func_name or "").rsplit(".", 1)[-1],
            "args": list(job.args or []),
            "description": job.description,
            "status": str(status.value if hasattr(status, "value") else status),
            "enqueued_at": ts(job.enqueued_at),
            "started_at": ts(job.started_at),
            "ended_at": ts(job.ended_at),
            "result": result,
            "error": error,
        }

    def get(self, job_id: str) -> dict[str, Any] | None:
        from rq.exceptions import NoSuchJobError
        from rq.job import Job

        try:
            return self._dump(Job.fetch(job_id, connection=self.redis))
        except NoSuchJobError:
            return None

    def recent(self, limit: int = 30) -> list[dict[str, Any]]:
        from rq.job import Job

        q = self.queue
        ids = (
            q.started_job_registry.get_job_ids()
            + q.get_job_ids()[:limit]
            + q.finished_job_registry.get_job_ids()[-limit:]
            + q.failed_job_registry.get_job_ids()[-limit:]
        )
        jobs = [j for j in Job.fetch_many(list(dict.fromkeys(ids)), connection=self.redis) if j]
        jobs.sort(key=lambda j: j.enqueued_at.timestamp() if j.enqueued_at else 0, reverse=True)
        return [self._dump(j) for j in jobs[:limit]]

    def stats(self) -> dict[str, Any]:
        from rq import Worker

        q = self.queue
        return {
            "backend": self.name,
            "workers": len(Worker.all(connection=self.redis)),
            "counts": {
                "queued": len(q),
                "started": q.started_job_registry.count,
                "finished": q.finished_job_registry.count,
                "failed": q.failed_job_registry.count,
            },
        }


_backend: Backend | None = None
_lock = threading.Lock()


def backend() -> Backend:
    global _backend
    with _lock:
        if _backend is None:
            if settings.redis_url:
                try:
                    _backend = RedisBackend(settings.redis_url)
                    log.info("Job queue: Redis at %s", settings.redis_url)
                except Exception as exc:
                    log.warning("Redis unavailable (%s); running jobs in-process", exc)
                    _backend = LocalBackend()
            else:
                _backend = LocalBackend()
        return _backend


def set_backend(b: Backend | None) -> None:
    global _backend
    _backend = b
