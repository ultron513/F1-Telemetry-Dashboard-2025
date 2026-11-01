"""Season-wide analytics without loading every session.

Each loaded session is flattened into two small Parquet tables, partitioned
Hive-style so DuckDB can prune by season / round / session::

    data/warehouse/results/season=2025/round=3/session=R/part.parquet
    data/warehouse/laps/season=2025/round=3/session=R/part.parquet

Writing happens once per session (automatically after it is loaded, or in
bulk through the ingest job); reads are plain SQL over all partitions.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import duckdb
import numpy as np
import pandas as pd
from fastf1.core import Session

from app.core.config import settings
from app.data.schedule import SessionRef

log = logging.getLogger("pitwall.warehouse")
TABLES = ("results", "laps")
_lock = threading.Lock()


def root() -> Path:
    return settings.warehouse_dir


def partition(table: str, ref: SessionRef) -> Path:
    return root() / table / f"season={ref.season}" / f"round={ref.round}" / f"session={ref.code}"


def has(ref: SessionRef) -> bool:
    return all((partition(t, ref) / "part.parquet").exists() for t in TABLES)


def _results_frame(ref: SessionRef, session: Session) -> pd.DataFrame:
    from app.services import results as results_svc

    rows = results_svc.classification(ref, session)
    res = session.results
    q = {}
    for _, r in res.iterrows():
        q[str(r.get("Abbreviation"))] = [
            r.get(k).total_seconds() if pd.notna(r.get(k)) else np.nan for k in ("Q1", "Q2", "Q3")
        ]
    frame = pd.DataFrame(
        [
            {
                "code": r["code"],
                "number": r["number"],
                "full_name": r["full_name"],
                "team": r["team"],
                "team_color": r["team_color"],
                "position": r["position"],
                "classified": r["classified_position"],
                "grid": r["grid"],
                "status": r["status"],
                "points": r["points"],
                "laps": r["laps"],
                "best_lap": r["best_lap"],
                "q1": q.get(r["code"], [np.nan] * 3)[0],
                "q2": q.get(r["code"], [np.nan] * 3)[1],
                "q3": q.get(r["code"], [np.nan] * 3)[2],
            }
            for r in rows
        ]
    )
    for col in ("position", "grid", "laps"):
        frame[col] = pd.to_numeric(frame[col], errors="coerce").astype("Int64")
    for col in ("points", "best_lap", "q1", "q2", "q3"):
        frame[col] = pd.to_numeric(frame[col], errors="coerce").astype(float)
    return frame


def _laps_frame(session: Session) -> pd.DataFrame:
    from app.services import common

    laps = session.laps
    clean_idx = set(common.clean_laps(laps).index)
    secs = lambda col: laps[col].dt.total_seconds()  # noqa: E731
    return pd.DataFrame(
        {
            "code": laps["Driver"].astype(str),
            "team": laps["Team"].astype(str),
            "lap": pd.to_numeric(laps["LapNumber"], errors="coerce").astype("Int64"),
            "lap_time": secs("LapTime"),
            "s1": secs("Sector1Time"),
            "s2": secs("Sector2Time"),
            "s3": secs("Sector3Time"),
            "compound": laps["Compound"].astype("string"),
            "tyre_life": pd.to_numeric(laps["TyreLife"], errors="coerce"),
            "stint": pd.to_numeric(laps["Stint"], errors="coerce"),
            "position": pd.to_numeric(laps["Position"], errors="coerce"),
            "speed_trap": pd.to_numeric(laps["SpeedST"], errors="coerce"),
            "track_status": laps["TrackStatus"].astype("string"),
            "pit": laps["PitInTime"].notna() | laps["PitOutTime"].notna(),
            "clean": [i in clean_idx for i in laps.index],
        }
    )


def ingest(ref: SessionRef, session: Session, *, force: bool = False) -> bool:
    """Write both tables for one session. Returns False if already present."""
    if has(ref) and not force:
        return False
    frames = {"results": _results_frame(ref, session), "laps": _laps_frame(session)}
    with _lock:
        for table, frame in frames.items():
            target = partition(table, ref)
            target.mkdir(parents=True, exist_ok=True)
            tmp = target / "part.parquet.tmp"
            frame.to_parquet(tmp, index=False)
            tmp.replace(target / "part.parquet")
    log.info("Warehouse: ingested %s %s %s", ref.season, ref.round, ref.code)
    return True


def ingest_in_background(ref: SessionRef, session: Session) -> None:
    if not settings.warehouse_auto_ingest or has(ref):
        return

    def run() -> None:
        try:
            ingest(ref, session)
        except Exception:
            log.exception("Warehouse ingest failed for %s", ref.key)

    threading.Thread(target=run, name=f"warehouse-{ref.key}", daemon=True).start()


def connect() -> duckdb.DuckDBPyConnection:
    """In-memory DuckDB with one view per table over every Parquet partition."""
    con = duckdb.connect()
    for table in TABLES:
        pattern = root() / table / "**" / "*.parquet"
        if any((root() / table).glob("**/*.parquet")):
            # DDL can't take bound parameters; the path comes from config, quotes escaped.
            glob = str(pattern).replace("'", "''")
            con.execute(
                f"CREATE VIEW {table} AS SELECT * FROM read_parquet('{glob}', "
                "hive_partitioning = true, union_by_name = true)"
            )
        else:
            con.execute(f"CREATE VIEW {table} AS SELECT * FROM (SELECT 1) WHERE false")
    return con


def query(sql: str, params: list[Any] | None = None) -> pd.DataFrame:
    with connect() as con:
        return con.execute(sql, params or []).df()


def inventory() -> list[dict[str, Any]]:
    """What has been ingested."""
    out = []
    base = root() / "results"
    for path in sorted(base.glob("season=*/round=*/session=*/part.parquet")):
        parts = {p.split("=")[0]: p.split("=")[1] for p in path.parent.relative_to(base).parts}
        out.append(
            {
                "season": int(parts["season"]),
                "round": int(parts["round"]),
                "session": parts["session"],
            }
        )
    return out
