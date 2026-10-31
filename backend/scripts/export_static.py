"""Export the whole API as static JSON files.

Every response the dashboard needs is rendered through the real FastAPI app
(in-process, so shapes and validation are identical to the live API) and
written to a folder that mirrors the API paths:

    v1/seasons.json
    v1/seasons/{season}/events.json            (sessions carry "available")
    v1/seasons/{season}/index.json             (what has been exported)
    v1/seasons/{season}/standings/latest.json
    v1/seasons/{season}/standings/{round}.json
    v1/sessions/{season}/{round}/{code}/{leaf}.json
    v1/sessions/{season}/{round}/{code}/{leaf}/{DRIVER}.json

The website reads these files directly (NEXT_PUBLIC_DATA_URL), so no Python
server is needed in production. With --upload the files are pushed to a
Hugging Face dataset after every race weekend, which makes long runs
resumable: already exported sessions are skipped on the next run.

Usage:
    python scripts/export_static.py --seasons 2025 --out ../data-out
    python scripts/export_static.py --seasons 2023 2024 --upload --time-budget 320
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

# One session in memory at a time keeps a CI runner comfortably within RAM.
os.environ.setdefault("F1_SESSION_CACHE_SIZE", "1")

log = logging.getLogger("pitwall.export")

SESSION_LEAVES = [
    "pace",
    "circuit",
    "strategy",
    "race-trace",
    "race-control",
    "weather",
    "ratings",
    "replay",
]
DRIVER_LEAVES = ["laps", "telemetry", "degradation", "recommendation"]


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


class Exporter:
    def __init__(self, out: Path, *, force: bool, keep_cache: bool, upload: bool):
        from fastapi.testclient import TestClient

        from app.main import app

        self.client = TestClient(app, raise_server_exceptions=False)
        self.root = out / "v1"
        self.root.mkdir(parents=True, exist_ok=True)
        self.force = force
        self.keep_cache = keep_cache
        self.hub = Hub() if upload else None

    # -- io ----------------------------------------------------------------

    def get(self, path: str, **params) -> tuple[int, bytes]:
        response = self.client.get(f"/api/v1{path}", params=params or None)
        return response.status_code, response.content

    def write(self, rel: str, content: bytes | dict) -> None:
        target = self.root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, dict):
            content = json.dumps(content, separators=(",", ":")).encode()
        target.write_bytes(content)

    def read_json(self, rel: str) -> dict | None:
        target = self.root / rel
        if not target.exists() and self.hub:
            self.hub.download(f"v1/{rel}", target)
        if target.exists():
            return json.loads(target.read_text())
        return None

    # -- export --------------------------------------------------------------

    def export_meta(self) -> None:
        status, body = self.get("/seasons")
        if status == 200:
            self.write("seasons.json", body)
            if self.hub:
                self.hub.upload(self.root, ["seasons.json"], "Update season list")

    def export_session(self, season: int, rnd: int, code: str) -> str | None:
        """Returns None on success, otherwise the reason it failed."""
        base = f"/sessions/{season}/{rnd}/{code}"
        rel = f"sessions/{season}/{rnd}/{code}"
        status, body = self.get(f"{base}/summary")
        if status != 200:
            try:
                return json.loads(body)["error"]["message"]
            except Exception:
                return f"HTTP {status}"
        self.write(f"{rel}/summary.json", body)
        summary = json.loads(body)

        for leaf in SESSION_LEAVES:
            status, body = self.get(f"{base}/{leaf}")
            if status == 200:
                self.write(f"{rel}/{leaf}.json", body)
            else:
                log.warning("  %s %s → HTTP %s", rel, leaf, status)

        for driver in [d["code"] for d in summary["drivers"]]:
            for leaf in DRIVER_LEAVES:
                params = {"driver": driver}
                if leaf == "telemetry":
                    params["lap"] = "fastest"
                status, body = self.get(f"{base}/{leaf}", **params)
                if status == 200:
                    self.write(f"{rel}/{leaf}/{driver}.json", body)
        return None

    def free_memory(self, season: int) -> None:
        from app.api import payloads
        from app.data.session_store import store

        store.clear()
        for name in dir(payloads):
            fn = getattr(payloads, name)
            cache = getattr(fn, "cache", None)
            if cache is not None:
                cache.clear()
        if not self.keep_cache:
            # Raw FastF1 downloads are only needed while exporting a session.
            from app.core.config import settings

            season_dir = settings.cache_dir / str(season)
            if season_dir.exists():
                shutil.rmtree(season_dir, ignore_errors=True)

    def export_season(
        self, season: int, rounds: set[int] | None, deadline: float, sessions: set[str] | None
    ) -> bool:
        """Export one season. Returns False if it stopped early on the time budget."""
        status, body = self.get(f"/seasons/{season}/events")
        if status != 200:
            log.error("Season %s calendar unavailable: %s", season, body[:200])
            return True
        events = json.loads(body)
        index = self.read_json(f"seasons/{season}/index.json") or {
            "season": season,
            "sessions": {},
            "failed": {},
        }
        index.setdefault("failed", {})
        finished = True
        now = datetime.now(UTC)

        for event in events["events"]:
            rnd = event["round"]
            if event["status"] != "completed" or (rounds and rnd not in rounds):
                continue
            exported_any = False
            for slot in event["sessions"]:
                code = slot["code"]
                if sessions and code not in sessions:
                    continue
                if (
                    slot["start_utc"]
                    and datetime.fromisoformat(slot["start_utc"].replace("Z", "+00:00")) > now
                ):
                    continue
                key = f"{rnd}/{code}"
                if key in index["sessions"] and not self.force:
                    continue
                if time.monotonic() > deadline:
                    finished = False
                    break
                started = time.monotonic()
                error = self.export_session(season, rnd, code)
                if error:
                    index["failed"][key] = {"reason": error, "at": now_iso()}
                    log.warning("✗ %s R%s %s: %s", season, rnd, code, error)
                else:
                    index["sessions"][key] = {"exported": now_iso()}
                    index["failed"].pop(key, None)
                    exported_any = True
                    log.info("✓ %s R%s %s in %.0fs", season, rnd, code, time.monotonic() - started)
            self.free_memory(season)
            if exported_any:
                status, body = self.get(f"/seasons/{season}/standings", round=rnd)
                if status == 200:
                    self.write(f"seasons/{season}/standings/{rnd}.json", body)
                self.write_season_meta(season, events, index)
                if self.hub:
                    self.hub.upload(
                        self.root,
                        [f"sessions/{season}/{rnd}/**", f"seasons/{season}/**"],
                        f"Export {season} round {rnd}",
                    )
            if not finished:
                break

        status, body = self.get(f"/seasons/{season}/standings")
        if status == 200:
            self.write(f"seasons/{season}/standings/latest.json", body)
        self.write_season_meta(season, events, index)
        if self.hub:
            self.hub.upload(
                self.root, [f"seasons/{season}/**"], f"Update {season} calendar and standings"
            )
        return finished

    def write_season_meta(self, season: int, events: dict, index: dict) -> None:
        done = set(index["sessions"])
        annotated = json.loads(json.dumps(events))
        for event in annotated["events"]:
            for slot in event["sessions"]:
                slot["available"] = f"{event['round']}/{slot['code']}" in done
        for key in ("next_event", "last_completed"):
            ev = annotated.get(key)
            if ev:
                for slot in ev["sessions"]:
                    slot["available"] = f"{ev['round']}/{slot['code']}" in done
        index["updated"] = now_iso()
        self.write(f"seasons/{season}/events.json", annotated)
        self.write(f"seasons/{season}/index.json", index)


class Hub:
    """Thin wrapper over huggingface_hub with retries."""

    def __init__(self):
        from huggingface_hub import HfApi

        self.repo = os.environ["HF_DATASET"]
        self.api = HfApi(token=os.environ["HF_TOKEN"])
        self.api.create_repo(self.repo, repo_type="dataset", exist_ok=True, private=False)

    def download(self, path_in_repo: str, target: Path) -> None:
        from huggingface_hub import hf_hub_download

        try:
            local = hf_hub_download(
                self.repo, path_in_repo, repo_type="dataset", token=self.api.token
            )
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(local, target)
        except Exception:
            pass  # first run: nothing published yet

    def upload(self, folder: Path, patterns: list[str], message: str) -> None:
        for attempt in range(1, 5):
            try:
                self.api.upload_folder(
                    repo_id=self.repo,
                    repo_type="dataset",
                    folder_path=str(folder),
                    path_in_repo="v1",
                    allow_patterns=patterns,
                    commit_message=message,
                )
                return
            except Exception as exc:
                log.warning("Upload attempt %s failed: %s", attempt, exc)
                time.sleep(15 * attempt)
        raise RuntimeError(f"Upload failed: {message}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--seasons", type=int, nargs="*", default=[])
    parser.add_argument("--rounds", type=int, nargs="*", help="Only these rounds")
    parser.add_argument("--sessions", nargs="*", help="Only these session codes, e.g. R Q")
    parser.add_argument("--out", type=Path, default=BACKEND.parent / "data-out")
    parser.add_argument("--force", action="store_true", help="Re-export sessions already exported")
    parser.add_argument("--keep-cache", action="store_true", help="Keep raw FastF1 downloads")
    parser.add_argument(
        "--upload", action="store_true", help="Push to the HF dataset in HF_DATASET"
    )
    parser.add_argument(
        "--time-budget", type=float, default=0, help="Minutes before stopping cleanly"
    )
    parser.add_argument("--meta", action="store_true", help="Also export seasons.json")
    args = parser.parse_args()

    logging.basicConfig(level=logging.ERROR, format="%(asctime)s %(message)s")
    log.setLevel(logging.INFO)
    import fastf1

    fastf1.set_log_level("ERROR")

    exporter = Exporter(args.out, force=args.force, keep_cache=args.keep_cache, upload=args.upload)
    deadline = time.monotonic() + (args.time_budget * 60 if args.time_budget else 10**9)
    complete = True
    for season in args.seasons:
        complete &= exporter.export_season(
            season,
            set(args.rounds) if args.rounds else None,
            deadline,
            {s.upper() for s in args.sessions} if args.sessions else None,
        )
    if args.meta:
        exporter.export_meta()
    if not complete:
        log.info("Stopped on the time budget; the next run continues where this one ended.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
