"""RQ worker entry point: ``python -m app.jobs.worker``.

Run as many as you like; each one loads sessions into the shared FastF1
cache and writes the shared Parquet warehouse.
"""

from __future__ import annotations

import logging
import sys

from app.core.config import settings
from app.core.fastf1_setup import configure_fastf1
from app.core.observability import setup_tracing
from app.jobs.queue import QUEUE_NAME


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Pit Wall background worker (RQ)")
    parser.add_argument("--burst", action="store_true", help="Exit once the queue is empty")
    args = parser.parse_args(argv)
    if not settings.redis_url:
        print("REDIS_URL is not set; the API runs jobs in-process instead.", file=sys.stderr)
        return 2
    from redis import Redis
    from rq import Queue, Worker

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s"
    )
    configure_fastf1()
    setup_tracing(service_suffix="worker")
    conn = Redis.from_url(settings.redis_url)
    Worker([Queue(QUEUE_NAME, connection=conn)], connection=conn).work(
        with_scheduler=False, burst=args.burst
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
