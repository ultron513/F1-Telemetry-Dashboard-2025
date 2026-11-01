"""Race-time analytics computed on every live snapshot.

* **Pit window** – where each car would rejoin if it pitted now.
* **Win / podium probability** – a Monte Carlo over the remaining laps using
  each car's recent pace, the stops it still owes and the chance of a
  safety car bunching the field.
* **Alerts** – what changed since the previous snapshot that a fan or a pit
  wall would want to be told about.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any

import numpy as np

DRY = {"SOFT", "MEDIUM", "HARD"}
LAP_NOISE = 0.35  # s per lap, random pace variation
EVENT_NOISE = 0.55  # s per lap, unmodelled incidents / traffic / strategy
SC_PER_LAP = 0.012  # chance of a safety car starting on any given lap
SC_COMPRESSION = 0.25  # gaps that survive a safety-car restart
PACE_PRIOR_LAPS = 6.0  # shrink a car's pace toward the field until it has history


@dataclass
class PaceTracker:
    """Rolling clean lap times per car (pit and neutralised laps excluded)."""

    window: int = 6
    laps: dict[str, deque[float]] = field(default_factory=dict)
    last_count: dict[str, int] = field(default_factory=dict)

    def update(self, rows: list[dict[str, Any]], neutralised: bool) -> None:
        for r in rows:
            count = r.get("laps") or 0
            prev = self.last_count.get(r["number"], 0)
            if count > prev:
                self.last_count[r["number"]] = count
                lap = r.get("last_lap")
                if lap and not neutralised and not r["in_pit"] and not r["pit_out"]:
                    q = self.laps.setdefault(r["number"], deque(maxlen=self.window))
                    if not q or lap < np.median(q) * 1.06:  # drop traffic/mistake laps
                        q.append(lap)

    def pace(self, number: str) -> float | None:
        q = self.laps.get(number)
        return float(np.median(q)) if q else None


def owes_stop(row: dict[str, Any]) -> bool:
    """Dry race rule: a car must use two different dry compounds."""
    used = set(row.get("compounds_used") or [])
    if used - DRY:  # inters / wets used: rule no longer applies
        return False
    return len(used & DRY) < 2


def pit_window(rows: list[dict[str, Any]], pit_loss: float) -> list[dict[str, Any]]:
    """Projected rejoin position, and the cars either side, if each car pitted now."""
    running = [r for r in rows if not r["retired"] and r["gap"] is not None and r["laps_down"] == 0]
    out = []
    for r in running:
        new_gap = (r["gap"] or 0.0) + pit_loss
        others = sorted((o for o in running if o is not r), key=lambda o: o["gap"] or 0.0)
        ahead = [o for o in others if (o["gap"] or 0.0) <= new_gap]
        behind = [o for o in others if (o["gap"] or 0.0) > new_gap]
        car_ahead = ahead[-1] if ahead else None
        car_behind = behind[0] if behind else None
        out.append(
            {
                "number": r["number"],
                "code": r["code"],
                "position": r["position"],
                "rejoin_position": len(ahead) + 1,
                "positions_lost": len(ahead) + 1 - r["position"],
                "car_ahead": car_ahead["code"] if car_ahead else None,
                "gap_ahead": round(new_gap - (car_ahead["gap"] or 0.0), 2) if car_ahead else None,
                "car_behind": car_behind["code"] if car_behind else None,
                "gap_behind": round((car_behind["gap"] or 0.0) - new_gap, 2)
                if car_behind
                else None,
                "free_stop": len(ahead) + 1 == r["position"],
                "owes_stop": owes_stop(r),
            }
        )
    return out


def probabilities(
    rows: list[dict[str, Any]],
    pace: PaceTracker,
    laps_left: int,
    pit_loss: float,
    runs: int = 2000,
    seed: int = 11,
) -> list[dict[str, Any]]:
    running = [r for r in rows if not r["retired"] and r["gap"] is not None and r["laps_down"] == 0]
    if not running:
        return []
    known = [p for p in (pace.pace(r["number"]) for r in running) if p]
    field_pace = float(np.median(known)) if known else 90.0
    n = len(running)
    gaps = np.array([r["gap"] or 0.0 for r in running])
    rates = np.empty(n)
    for i, r in enumerate(running):
        p = pace.pace(r["number"])
        history = len(pace.laps.get(r["number"], ()))
        w = history / (history + PACE_PRIOR_LAPS)
        rates[i] = w * (p if p else field_pace) + (1 - w) * field_pace
    owed = np.array([pit_loss if owes_stop(r) else 0.0 for r in running])
    if laps_left <= 0:
        win = np.zeros(n)
        win[np.argmin(gaps)] = 1
        podium = np.zeros(n)
        podium[np.argsort(gaps)[:3]] = 1
    else:
        rng = np.random.default_rng(seed)
        sd = np.sqrt(laps_left) * np.hypot(LAP_NOISE, EVENT_NOISE)
        base = gaps + owed + laps_left * (rates - rates.min())
        totals = base + rng.normal(0.0, sd, size=(runs, n))
        # Stops still to come vary in execution (slow stop, traffic on exit).
        totals += (owed > 0) * rng.normal(0.0, 1.5, size=(runs, n))
        sc = rng.random(runs) < 1 - (1 - SC_PER_LAP) ** laps_left
        if sc.any():
            # A safety car bunches the field: most of the gap built so far vanishes.
            lead = totals[sc].min(axis=1, keepdims=True)
            totals[sc] = (
                lead
                + (totals[sc] - lead) * SC_COMPRESSION
                + rng.normal(0.0, 0.8, size=(int(sc.sum()), n))
            )
        order = np.argsort(totals, axis=1)
        win = np.bincount(order[:, 0], minlength=n) / runs
        podium = np.zeros(n)
        for k in range(min(3, n)):
            podium += np.bincount(order[:, k], minlength=n) / runs
    out = [
        {
            "number": r["number"],
            "code": r["code"],
            "team_color": r["team_color"],
            "win": round(float(win[i]), 4),
            "podium": round(float(min(1.0, podium[i])), 4),
            "pace": round(float(rates[i]), 3),
        }
        for i, r in enumerate(running)
    ]
    out.sort(key=lambda x: (-x["win"], -x["podium"]))
    return out


SEVERITY = {
    "red-flag": "critical",
    "safety-car": "critical",
    "vsc": "warning",
    "penalty": "warning",
    "investigation": "info",
    "retirement": "warning",
    "lead-change": "info",
    "fastest-lap": "info",
    "pit": "info",
    "rain": "warning",
    "green": "info",
    "chequered": "info",
}


def alerts(prev: dict[str, Any] | None, cur: dict[str, Any]) -> list[dict[str, Any]]:
    """Diff two snapshots into human-readable alerts."""
    if prev is None:
        return []
    out: list[dict[str, Any]] = []
    lap = cur.get("lap")

    def add(kind: str, title: str, message: str) -> None:
        out.append(
            {
                "kind": kind,
                "severity": SEVERITY.get(kind, "info"),
                "title": title,
                "message": message,
                "lap": lap,
                "clock": cur.get("clock"),
            }
        )

    ps, cs = prev["track_status"]["code"], cur["track_status"]["code"]
    if ps != cs:
        if cs == "4":
            add("safety-car", "Safety car", "The safety car has been deployed.")
        elif cs == "5":
            add("red-flag", "Red flag", "The session has been red-flagged.")
        elif cs == "6":
            add(
                "vsc",
                "Virtual safety car",
                "VSC deployed — free-ish pit stops for those who need one.",
            )
        elif cs == "1" and ps in {"4", "5", "6", "7"}:
            add("green", "Green flag", "Racing resumes.")

    p_rows = {r["number"]: r for r in prev["drivers"]}
    c_rows = cur["drivers"]
    leader = next((r for r in c_rows if not r["retired"]), None)
    p_leader = next((r for r in prev["drivers"] if not r["retired"]), None)
    if leader and p_leader and leader["number"] != p_leader["number"]:
        add(
            "lead-change", "New leader", f"{leader['code']} takes the lead from {p_leader['code']}."
        )

    for r in c_rows:
        p = p_rows.get(r["number"])
        if not p:
            continue
        if r["retired"] and not p["retired"]:
            add("retirement", "Retirement", f"{r['code']} is out of the race.")
        if r["in_pit"] and not p["in_pit"] and not r["retired"]:
            add(
                "pit", f"{r['code']} pits", f"{r['code']} is in the pit lane from P{r['position']}."
            )
        if r["last_lap_overall_best"] and r["last_lap"] and r["last_lap"] != p.get("last_lap"):
            m, s = divmod(r["last_lap"], 60)
            add(
                "fastest-lap",
                "Fastest lap",
                f"{r['code']} sets the fastest lap: {int(m)}:{s:06.3f}.",
            )

    p_msgs = len(prev["race_control"])
    for m in cur["race_control"][p_msgs:] if len(cur["race_control"]) > p_msgs else []:
        text = (m.get("message") or "").upper()
        if "PENALTY" in text and "NO FURTHER" not in text:
            add("penalty", "Penalty", m["message"])
        elif "UNDER INVESTIGATION" in text or ("NOTED" in text and "INCIDENT" in text):
            add("investigation", "Stewards", m["message"])
        elif m.get("flag") == "CHEQUERED":
            add("chequered", "Chequered flag", m["message"])

    pw, cw = prev.get("weather") or {}, cur.get("weather") or {}
    if cw.get("rain") and not pw.get("rain"):
        add("rain", "Rain", "Rain reported at the circuit.")
    return out
