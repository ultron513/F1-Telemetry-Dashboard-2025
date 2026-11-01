"""Generate docs/API.md and docs/openapi.json from the live FastAPI schema.

python scripts/gen_api_docs.py          # write
python scripts/gen_api_docs.py --check  # fail if the committed docs are stale (CI)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
DOCS = BACKEND.parent / "docs"
sys.path.insert(0, str(BACKEND))

TAG_ORDER = [
    "Meta",
    "Calendar & Championship",
    "Session",
    "Laps",
    "Telemetry",
    "Circuit",
    "Strategy",
    "Simulator",
    "Analysis",
    "Race Control",
    "Weather",
    "Performance",
    "Replay",
    "Live",
    "History",
    "Operations",
]


def _type(schema: dict) -> str:
    if "anyOf" in schema:
        return " | ".join(_type(s) for s in schema["anyOf"])
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    if schema.get("type") == "array":
        return f"{_type(schema.get('items', {}))}[]"
    return schema.get("type", "any")


def render(spec: dict) -> str:
    out = [
        "# Pit Wall API reference",
        "",
        "> Generated from the OpenAPI schema by `backend/scripts/gen_api_docs.py`; do not edit by hand.",
        "> Interactive docs: `http://localhost:8000/docs`. Machine-readable: [`openapi.json`](openapi.json).",
        "",
        f"**Version {spec['info']['version']}.** All paths are under `/api/v1`. Errors are "
        '`{"error": {"code", "message", "hint"}}` with a matching HTTP status. '
        "Session paths take `{season}` (2018+), `{round}` and `{session}` (`FP1`, `FP2`, `FP3`, `SQ`, `S`, `Q`, `R`).",
        "",
        "A typed Python client lives in [`sdk/python`](../sdk/python).",
        "",
    ]
    by_tag: dict[str, list[tuple[str, str, dict]]] = {}
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            tag = (op.get("tags") or ["Other"])[0]
            by_tag.setdefault(tag, []).append((path, method.upper(), op))
    tags = [t for t in TAG_ORDER if t in by_tag] + sorted(t for t in by_tag if t not in TAG_ORDER)
    out.append("## Contents\n")
    out += [
        f"- [{t}](#{t.lower().replace(' & ', '--').replace(' ', '-')}) ({len(by_tag[t])})"
        for t in tags
    ]
    out.append("")
    for tag in tags:
        out += [f"## {tag}", ""]
        for path, method, op in sorted(by_tag[tag], key=lambda x: x[0]):
            out.append(f"### `{method} {path}`")
            out.append("")
            if op.get("summary"):
                out += [op["summary"] + ".", ""]
            if op.get("description"):
                out += [op["description"].strip(), ""]
            params = [p for p in op.get("parameters", []) if p["in"] in {"query", "header"}]
            if params:
                out += [
                    "| Parameter | In | Type | Required | Description |",
                    "| --- | --- | --- | --- | --- |",
                ]
                for p in params:
                    sch = p.get("schema", {})
                    default = f" (default `{sch['default']}`)" if "default" in sch else ""
                    desc = (p.get("description") or sch.get("description") or "").replace(
                        "|", "\\|"
                    )
                    out.append(
                        f"| `{p['name']}` | {p['in']} | `{_type(sch)}` | {'yes' if p.get('required') else 'no'} | {desc}{default} |"
                    )
                out.append("")
            body = (
                op.get("requestBody", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema")
            )
            if body:
                out += [f"Body: `{_type(body)}` (JSON)", ""]
            ok = (
                op.get("responses", {})
                .get("200", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema")
            )
            if ok and _type(ok) not in {"any", "object"}:
                out += [f"Returns: `{_type(ok)}`", ""]
    out += [
        "## WebSocket: live timing",
        "",
        "`GET /api/v1/live/ws` (WebSocket). `?mode=live` streams the real F1 feed during a session; "
        "`?mode=archive&season=2025&round=3&session=R&speed=20&start=0` replays a finished session as if live. "
        "The server sends `hello`, then a `snapshot` about once a second (timing tower, pit windows, win "
        "probabilities, race control, `alerts`), and `end` when a replay finishes. Send "
        '`{"speed": 60}`, `{"paused": true}` or `{"seek": 1800}` to control a replay.',
        "",
    ]
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    from app.main import app

    spec = app.openapi()
    md = render(spec)
    js = json.dumps(spec, indent=2, sort_keys=True) + "\n"
    targets = {DOCS / "API.md": md, DOCS / "openapi.json": js}
    if args.check:
        stale = [p.name for p, text in targets.items() if not p.exists() or p.read_text() != text]
        if stale:
            print(
                f"Stale API docs: {', '.join(stale)}. Run python scripts/gen_api_docs.py",
                file=sys.stderr,
            )
            return 1
        return 0
    for p, text in targets.items():
        p.write_text(text)
        print(f"wrote {p.relative_to(BACKEND.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
