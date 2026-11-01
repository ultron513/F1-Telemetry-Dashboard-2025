"""Race strategy simulator.

The model is fitted on the race's own clean green-flag laps with ordinary
least squares::

    lap_time = driver_pace[d] + compound_offset[c] + wear[c] · tyre_age
               + fuel · lap_number (+ cliff[c] beyond the compound's life)

* ``driver_pace`` absorbs car + driver speed, so compound and wear terms are
  shared across the field (more data per term, less noise).
* ``fuel`` is the field-wide lap-time gain per lap as the cars get lighter.
* Compounds that were not raced fall back to typical Pirelli-range priors and
  are flagged as such.

Strategies are simulated *relative to what the driver actually did*: both the
plan and the real strategy are run through the same model under the same race
conditions, and the difference is added to the real race time. Lap-one start
losses, traffic and slow stops therefore cancel out, and the projected
finishing position is read off against every other car's real race time.

Two kinds of race conditions are available:

* ``hindsight`` – the real safety-car / VSC laps happen exactly when they did.
* ``monte-carlo`` – random neutralisations (and lap noise) are drawn many
  times, giving a distribution of outcomes rather than a single number.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product
from typing import Any

import numpy as np
import pandas as pd
from fastf1.core import Session

from app.core.errors import InvalidParameterError, NotFoundError
from app.core.serialize import integer, is_missing, num
from app.services import common, strategy as strategy_svc

DRY = ("SOFT", "MEDIUM", "HARD")
WET = ("INTERMEDIATE", "WET")

# Typical relative pace (s/lap vs MEDIUM), wear (s/lap per lap of age) and
# useful life (laps) — used only for compounds that were not raced.
PRIORS: dict[str, dict[str, float]] = {
    "SOFT": {"offset": -0.55, "wear": 0.085, "life": 20},
    "MEDIUM": {"offset": 0.0, "wear": 0.055, "life": 30},
    "HARD": {"offset": 0.45, "wear": 0.035, "life": 42},
    "INTERMEDIATE": {"offset": 0.0, "wear": 0.06, "life": 30},
    "WET": {"offset": 0.0, "wear": 0.05, "life": 35},
}
CLIFF_RATE = 0.06  # extra s/lap² once a tyre is past its useful life
# Mixed wet/dry races: running a compound on a lap where nobody in the field
# could use it (slicks on a wet track, inters on a dry one) costs this much.
CROSSOVER_PENALTY = 12.0
MIN_SAMPLES = 15  # clean laps needed before a compound is fitted from data

# Neutralisations: duration in laps and pit-loss multiplier (stops are cheaper
# because the field is slow).
NEUTRAL = {"SC": {"laps": 4, "pit_factor": 0.45}, "VSC": {"laps": 2, "pit_factor": 0.6}}
DEFAULT_SC_RATE = 0.55  # expected safety cars per race when the user doesn't say
DEFAULT_VSC_RATE = 0.35


# --------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------


@dataclass
class CompoundModel:
    compound: str
    offset: float
    wear: float
    life: float
    samples: int
    source: str  # "fitted" | "prior"


@dataclass
class TyreModel:
    reference: str
    compounds: dict[str, CompoundModel]
    driver_pace: dict[str, float]
    fuel: float
    sigma: float
    r2: float
    total_laps: int
    pit_loss: float
    pit_loss_source: str
    neutral_laps: dict[int, str]  # lap -> "SC" | "VSC" in the real race
    neutral_lap_time: dict[int, float]  # median field lap time on those laps
    wet: bool
    race_start: float
    viable: dict[str, set[int]] | None = None  # mixed races: laps each compound worked
    lap_effect: np.ndarray | None = None  # mixed races: per-lap track condition
    actual: dict[str, dict[str, Any]] = field(default_factory=dict)

    def compound(self, name: str) -> CompoundModel:
        name = name.upper()
        if name not in self.compounds:
            raise InvalidParameterError(
                f"Compound '{name}' is not available.",
                hint=f"Use one of {', '.join(self.compounds)}.",
            )
        return self.compounds[name]

    def crossover(self, stints: list[tuple[str, int, int]]) -> np.ndarray:
        """Penalty on laps where a compound couldn't work (mixed races only)."""
        total = sum(n for _, n, _ in stints)
        out = np.zeros(total)
        if self.viable is None:
            return out
        lap = 1
        for comp, n, _ in stints:
            ok = self.viable.get(comp.upper(), set())
            for k in range(n):
                if lap + k not in ok:
                    out[lap + k - 1] = CROSSOVER_PENALTY
            lap += n
        return out

    def lap_term(self, laps: np.ndarray) -> np.ndarray:
        if self.lap_effect is not None:
            idx = np.clip(laps.astype(int) - 1, 0, len(self.lap_effect) - 1)
            return self.lap_effect[idx]
        return self.fuel * laps

    def lap_times(self, driver: str, stints: list[tuple[str, int, int]]) -> np.ndarray:
        """Green-flag lap times for consecutive stints of (compound, laps, start_age)."""
        base = self.driver_pace[driver]
        out: list[np.ndarray] = []
        lap = 1
        for comp, n, start_age in stints:
            m = self.compound(comp)
            age = np.arange(1, n + 1, dtype=float) + start_age
            laps = np.arange(lap, lap + n, dtype=float)
            over = np.clip(age - m.life, 0, None)
            t = base + m.offset + m.wear * age + CLIFF_RATE * over**2 + self.lap_term(laps)
            out.append(t)
            lap += n
        return np.concatenate(out) if out else np.zeros(0)


def _clean_race_laps(session: Session) -> pd.DataFrame:
    laps = session.laps
    laps = laps[
        (laps["LapNumber"] > 1) & laps["TyreLife"].notna() & laps["Compound"].isin(DRY + WET)
    ]
    # 107 % filter per compound, so slower wet-tyre laps survive in mixed races.
    parts = [common.clean_laps(group) for _, group in laps.groupby("Compound")]
    parts = [p for p in parts if not p.empty]
    return pd.concat(parts) if parts else laps.iloc[0:0]


def _neutral_laps(session: Session) -> dict[int, str]:
    out: dict[int, str] = {}
    for item in strategy_svc._lap_status(session):
        if item["status"] == "4":
            out[item["lap"]] = "SC"
        elif item["status"] in {"6", "7"}:
            out[item["lap"]] = "VSC"
    return out


def _actual_results(session: Session, race_start: float) -> dict[str, dict[str, Any]]:
    """Real race time, laps completed and strategy for every driver."""
    out: dict[str, dict[str, Any]] = {}
    for d in common.drivers(session):
        laps = session.laps.pick_drivers(d["code"]).sort_values("LapNumber")
        laps = laps[laps["Time"].notna()]
        if laps.empty:
            continue
        last = laps.iloc[-1]
        stints = []
        for _, group in laps.groupby("Stint"):
            comp = group["Compound"].iloc[0]
            start_age = group["TyreLife"].iloc[0]
            name = str(comp) if not is_missing(comp) else "UNKNOWN"
            age0 = int(start_age) - 1 if not is_missing(start_age) else 0
            if stints:
                prev = stints[-1]
                # Same set carried on (FastF1 splits stints at red flags / SC
                # restarts even when the tyres weren't changed).
                if prev[0] == name and age0 == prev[2] + prev[1]:
                    stints[-1] = (name, prev[1] + int(len(group)), prev[2])
                    continue
            stints.append((name, int(len(group)), age0))
        out[d["code"]] = {
            "code": d["code"],
            "team": d["team"],
            "team_color": d["team_color"],
            "position": d["position"],
            "laps": int(last["LapNumber"]),
            "time": float(last["Time"].total_seconds()) - race_start,
            "stints": stints,
        }
    return out


def fit(session: Session) -> TyreModel:
    laps = _clean_race_laps(session)
    if len(laps) < 40:
        raise NotFoundError("Not enough clean race laps to fit a tyre model.")

    y = laps["LapTime"].dt.total_seconds().to_numpy(dtype=float)
    drivers = sorted(laps["Driver"].unique())
    raced = laps["Compound"].value_counts()
    fitted = [c for c in raced.index if raced[c] >= MIN_SAMPLES]
    reference = raced.index[0]
    if reference not in fitted:
        fitted.insert(0, reference)

    # Mixed wet/dry races: track conditions change lap by lap, so each lap gets
    # its own effect (which also absorbs fuel burn). Compound offsets are then
    # identified from cars on different tyres on the same lap.
    mixed = any(c in WET for c in raced.index) and any(c in DRY for c in raced.index)
    lap_ids = sorted(int(x) for x in laps["LapNumber"].unique())[1:] if mixed else []

    def design(frame: pd.DataFrame) -> np.ndarray:
        cols = [(frame["Driver"] == d).to_numpy(float) for d in drivers]
        lap_no = frame["LapNumber"].to_numpy(float)
        for lap in lap_ids:
            cols.append((lap_no == lap).astype(float))
        comp = frame["Compound"].to_numpy()
        age = frame["TyreLife"].to_numpy(float)
        for c in fitted:
            if c != reference:
                cols.append((comp == c).astype(float))
        for c in fitted:
            cols.append((comp == c) * age)
        if not mixed:
            cols.append(lap_no)
        return np.column_stack(cols)

    frame = laps[laps["Compound"].isin(fitted)]
    y = frame["LapTime"].dt.total_seconds().to_numpy(dtype=float)
    keep = np.ones(len(y), dtype=bool)
    coef = np.zeros(0)
    for _ in range(2):  # fit, drop outliers (traffic, mistakes), refit
        X = design(frame[keep])
        coef, *_ = np.linalg.lstsq(X, y[keep], rcond=None)
        resid = y - design(frame) @ coef
        mad = np.median(np.abs(resid[keep] - np.median(resid[keep]))) or 0.1
        keep = np.abs(resid) < 3.5 * 1.4826 * mad
    X = design(frame[keep])
    pred = X @ coef
    resid = y[keep] - pred
    ss_tot = float(((y[keep] - y[keep].mean()) ** 2).sum())
    r2 = 1 - float((resid**2).sum()) / ss_tot if ss_tot > 0 else 0.0

    nd = len(drivers)
    pace = {d: float(coef[i]) for i, d in enumerate(drivers)}
    lap_effect_fit = {lap: float(coef[nd + k]) for k, lap in enumerate(lap_ids)}
    offsets = {reference: 0.0}
    i = nd + len(lap_ids)
    for c in fitted:
        if c != reference:
            offsets[c] = float(coef[i])
            i += 1
    wears = {}
    for c in fitted:
        wears[c] = float(coef[i])
        i += 1
    lap_effect: np.ndarray | None = None
    if mixed:
        n_laps = common.total_laps(session) or int(session.laps["LapNumber"].max())
        known = {min(lap_ids) - 1 if lap_ids else 1: 0.0, **lap_effect_fit}
        xs = np.array(sorted(known), dtype=float)
        ys = np.array([known[int(x)] for x in xs])
        lap_effect = np.interp(np.arange(1, n_laps + 1, dtype=float), xs, ys)
        fuel = float(np.polyfit(xs, ys, 1)[0]) if len(xs) > 2 else 0.0
    else:
        fuel = float(coef[i])

    stint_lengths = laps.groupby(["Driver", "Stint", "Compound"]).size().reset_index(name="n")
    wet = any(c in WET for c in raced.index)

    def life_for(c: str) -> float:
        longest = stint_lengths.loc[stint_lengths["Compound"] == c, "n"].max()
        return max(PRIORS[c]["life"], float(longest) * 1.1 if not is_missing(longest) else 0.0)

    compounds: dict[str, CompoundModel] = {}
    for c in fitted:
        compounds[c] = CompoundModel(
            c, offsets[c], max(wears[c], -0.01), life_for(c), int(raced[c]), "fitted"
        )

    # Raced, but too few clean laps for its own regression terms: estimate the
    # offset directly from those laps with the fitted driver and fuel terms.
    for c in raced.index:
        if c in compounds or raced[c] < 3:
            continue
        rows = laps[laps["Compound"] == c]
        base = rows["Driver"].map(pace).to_numpy(float)
        t = rows["LapTime"].dt.total_seconds().to_numpy(float)
        age = rows["TyreLife"].to_numpy(float)
        ok = ~np.isnan(base)
        if ok.sum() < 3:
            continue
        lap_term = (
            lap_effect[rows["LapNumber"].to_numpy(int) - 1]
            if lap_effect is not None
            else fuel * rows["LapNumber"].to_numpy(float)
        )
        resid = t[ok] - base[ok] - lap_term[ok]
        off = float(np.median(resid - PRIORS[c]["wear"] * age[ok]))
        compounds[c] = CompoundModel(
            c, off, PRIORS[c]["wear"], life_for(c), int(raced[c]), "estimated"
        )

    # Never raced: Pirelli-range priors anchored to a raced compound of the
    # same family (dry or wet). Families with no anchor are not offered.
    for family in (DRY, WET):
        anchor = next((c for c in family if c in compounds), None)
        if anchor is None:
            continue
        for c in family:
            if c not in compounds:
                compounds[c] = CompoundModel(
                    c,
                    compounds[anchor].offset + PRIORS[c]["offset"] - PRIORS[anchor]["offset"],
                    PRIORS[c]["wear"],
                    PRIORS[c]["life"],
                    int(raced.get(c, 0)),
                    "prior",
                )
    viable = None
    if wet and any(c in DRY for c in raced.index):
        running = session.laps[
            session.laps["PitInTime"].isna()
            & session.laps["PitOutTime"].isna()
            & session.laps["Compound"].isin(DRY + WET)
        ]
        counts = running.groupby(["Compound", "LapNumber"]).size()
        viable = {}
        for c in compounds:
            family = DRY if c in DRY else WET
            laps_ok = {int(lap) for (comp, lap), n in counts.items() if comp in family and n >= 2}
            viable[c] = laps_ok
    order = {c: i for i, c in enumerate(DRY + WET)}
    compounds = dict(sorted(compounds.items(), key=lambda kv: order[kv[0]]))

    # Drivers with too few clean laps (early retirements) get the field median
    # pace so they can still be simulated.
    median_pace = float(np.median(list(pace.values())))
    for d in common.drivers(session):
        pace.setdefault(d["code"], median_pace)

    data = strategy_svc.strategy(session)
    pit_loss = data["pit_loss"]
    source = "measured"
    if not pit_loss:
        pit_loss = (data["median_pit_lane"] or 20.0) + 2.0
        source = "estimated"

    neutral = _neutral_laps(session)
    all_laps = session.laps[session.laps["LapTime"].notna()]
    neutral_time = {}
    for lap_no in neutral:
        times = all_laps.loc[all_laps["LapNumber"] == lap_no, "LapTime"].dt.total_seconds()
        if len(times):
            neutral_time[lap_no] = float(times.median())

    starts = session.laps["LapStartTime"].dropna()
    race_start = float(starts.min().total_seconds()) if len(starts) else 0.0

    return TyreModel(
        reference=reference,
        compounds=compounds,
        driver_pace=pace,
        fuel=fuel,
        sigma=float(resid.std()),
        r2=r2,
        total_laps=common.total_laps(session) or int(session.laps["LapNumber"].max()),
        pit_loss=float(pit_loss),
        pit_loss_source=source,
        neutral_laps=neutral,
        neutral_lap_time=neutral_time,
        wet=wet,
        race_start=race_start,
        viable=viable,
        lap_effect=lap_effect,
        actual=_actual_results(session, race_start),
    )


def _ranges(laps: set[int]) -> list[list[int]]:
    out: list[list[int]] = []
    for lap in sorted(laps):
        if out and lap == out[-1][1] + 1:
            out[-1][1] = lap
        else:
            out.append([lap, lap])
    return out


def describe(model: TyreModel, driver: str | None) -> dict[str, Any]:
    """The fitted model plus wear curves for the UI."""
    code = driver if driver in model.driver_pace else None
    curves = []
    for c, m in model.compounds.items():
        ages = np.arange(1, int(min(model.total_laps, m.life * 1.5)) + 1, dtype=float)
        over = np.clip(ages - m.life, 0, None)
        delta = m.offset + m.wear * ages + CLIFF_RATE * over**2
        curves.append(
            {
                "compound": c,
                "offset": num(m.offset),
                "wear": num(m.wear, 4),
                "life": num(m.life, 1),
                "samples": m.samples,
                "source": m.source,
                "points": [{"age": int(a), "delta": num(v)} for a, v in zip(ages, delta)],
            }
        )
    pace = sorted(model.driver_pace.items(), key=lambda kv: kv[1])
    best = pace[0][1] if pace else 0.0
    return {
        "reference": model.reference,
        "total_laps": model.total_laps,
        "fuel_effect": num(model.fuel, 4),
        "pit_loss": num(model.pit_loss, 2),
        "pit_loss_source": model.pit_loss_source,
        "lap_noise": num(model.sigma),
        "fit_r2": num(model.r2),
        "wet": model.wet,
        "mixed_conditions": model.viable is not None,
        "viable_laps": {c: _ranges(v) for c, v in model.viable.items()} if model.viable else {},
        "neutralised": [
            {"lap": lap, "kind": kind} for lap, kind in sorted(model.neutral_laps.items())
        ],
        "compounds": curves,
        "driver_pace": [
            {"code": c, "pace": num(p), "gap": num(p - best)} for c, p in pace if c in model.actual
        ],
        "driver": code,
        "actual_plan": [
            {"compound": c, "laps": n, "start_age": a}
            for c, n, a in model.actual.get(code, {}).get("stints", [])
        ]
        if code
        else [],
    }


# --------------------------------------------------------------------------
# Plans
# --------------------------------------------------------------------------


def parse_plan(raw: str) -> list[tuple[str, int, int]]:
    """``"M:20,H:33"`` → [("MEDIUM", 20, 0), ("HARD", 33, 0)].

    An optional third field is the tyre's starting age (``S:15:3`` = a soft
    set already used for three laps).
    """
    alias = {"S": "SOFT", "M": "MEDIUM", "H": "HARD", "I": "INTERMEDIATE", "W": "WET"}
    stints = []
    for chunk in filter(None, (p.strip() for p in raw.split(","))):
        parts = chunk.split(":")
        if len(parts) not in (2, 3):
            raise InvalidParameterError(f"Stint '{chunk}' must look like COMPOUND:LAPS, e.g. M:20.")
        comp = alias.get(parts[0].upper(), parts[0].upper())
        try:
            laps = int(parts[1])
            age = int(parts[2]) if len(parts) == 3 else 0
        except ValueError as exc:
            raise InvalidParameterError(f"Stint '{chunk}' has a non-numeric lap count.") from exc
        if laps < 1 or age < 0:
            raise InvalidParameterError(f"Stint '{chunk}' must have at least one lap.")
        stints.append((comp, laps, age))
    if not stints:
        raise InvalidParameterError("The plan has no stints.")
    return stints


def format_plan(stints: list[tuple[str, int, int]]) -> str:
    return ",".join(f"{c[0]}:{n}" + (f":{a}" if a else "") for c, n, a in stints)


def _check_plan(model: TyreModel, stints: list[tuple[str, int, int]], laps: int) -> list[str]:
    warnings = []
    total = sum(n for _, n, _ in stints)
    if total != laps:
        raise InvalidParameterError(
            f"The plan covers {total} laps but this driver needs {laps}.",
            hint="Adjust the last stint so the laps add up.",
        )
    for comp, _, _ in stints:
        model.compound(comp)
    if not model.wet and len({c for c, _, _ in stints}) < 2:
        warnings.append(
            "Dry races require at least two different compounds — this plan would be penalised."
        )
    for comp, n, age in stints:
        m = model.compounds[comp]
        if n + age > m.life * 1.2:
            warnings.append(
                f"{comp.title()} stint of {n} laps runs well past its ~{m.life:.0f}-lap life."
            )
    return warnings


# --------------------------------------------------------------------------
# Race conditions
# --------------------------------------------------------------------------


def _race_time(
    model: TyreModel,
    driver: str,
    stints: list[tuple[str, int, int]],
    neutral: dict[int, str],
    neutral_time: dict[int, float],
    noise: np.ndarray | None = None,
) -> tuple[float, np.ndarray]:
    """Total time and per-lap times for one plan under one set of conditions."""
    lap_times = model.lap_times(driver, stints)
    if noise is not None:
        lap_times = lap_times + noise[: len(lap_times)]
    for lap, kind in neutral.items():
        if 1 <= lap <= len(lap_times):
            slow = neutral_time.get(lap, lap_times[lap - 1] * (1.4 if kind == "SC" else 1.3))
            lap_times[lap - 1] = max(lap_times[lap - 1], slow)
    # Wrong tyres for the conditions still hurt behind the safety car.
    lap_times = lap_times + model.crossover(stints)
    stop_laps = np.cumsum([n for _, n, _ in stints])[:-1]
    total = float(lap_times.sum())
    for lap in stop_laps:
        kind = neutral.get(int(lap)) or neutral.get(int(lap) + 1)
        factor = NEUTRAL[kind]["pit_factor"] if kind else 1.0
        total += model.pit_loss * factor
        lap_times[int(lap) - 1] += model.pit_loss * factor
    return total, lap_times


def _random_conditions(
    model: TyreModel, rng: np.random.Generator, sc_rate: float, vsc_rate: float, laps: int
) -> tuple[dict[int, str], dict[int, float]]:
    neutral: dict[int, str] = {}
    for kind, rate in (("SC", sc_rate), ("VSC", vsc_rate)):
        for _ in range(rng.poisson(rate)):
            start = int(rng.integers(2, max(3, laps - 2)))
            for k in range(NEUTRAL[kind]["laps"]):
                neutral.setdefault(start + k, kind)
    base = float(np.median(list(model.driver_pace.values())))
    times = {lap: base * (1.4 if kind == "SC" else 1.3) for lap, kind in neutral.items()}
    return neutral, times


def _position(model: TyreModel, driver: str, laps: int, time: float) -> int:
    """Finishing position if ``driver`` completed ``laps`` in ``time`` seconds."""
    ahead = 0
    for code, r in model.actual.items():
        if code == driver:
            continue
        if r["laps"] > laps or (r["laps"] == laps and r["time"] < time):
            ahead += 1
    return ahead + 1


# --------------------------------------------------------------------------
# Public operations
# --------------------------------------------------------------------------


def _require(model: TyreModel, driver: str) -> dict[str, Any]:
    if driver not in model.actual:
        raise NotFoundError(f"{driver} has no timed laps in this race.")
    return model.actual[driver]


def simulate(
    model: TyreModel,
    driver: str,
    plan: str,
    sims: int = 400,
    sc_rate: float | None = None,
    vsc_rate: float | None = None,
    seed: int = 7,
) -> dict[str, Any]:
    actual = _require(model, driver)
    stints = parse_plan(plan)
    laps = actual["laps"]
    warnings = _check_plan(model, stints, laps)
    actual_stints = [
        (c if c in model.compounds else model.reference, n, a) for c, n, a in actual["stints"]
    ]

    # Hindsight: the real race's neutralisations.
    plan_t, plan_laps = _race_time(
        model, driver, stints, model.neutral_laps, model.neutral_lap_time
    )
    real_t, real_laps = _race_time(
        model, driver, actual_stints, model.neutral_laps, model.neutral_lap_time
    )
    delta = plan_t - real_t
    projected = actual["time"] + delta
    hindsight_pos = _position(model, driver, laps, projected)

    # Monte Carlo: random neutralisations + lap noise, paired comparison.
    rng = np.random.default_rng(seed)
    sc = DEFAULT_SC_RATE if sc_rate is None else sc_rate
    vsc = DEFAULT_VSC_RATE if vsc_rate is None else vsc_rate
    deltas = np.empty(sims)
    positions = np.empty(sims, dtype=int)
    for i in range(sims):
        neutral, times = _random_conditions(model, rng, sc, vsc, laps)
        noise = rng.normal(0, model.sigma, laps)
        a, _ = _race_time(model, driver, stints, neutral, times, noise)
        b, _ = _race_time(model, driver, actual_stints, neutral, times, noise)
        deltas[i] = a - b
        positions[i] = _position(model, driver, laps, actual["time"] + deltas[i])
    hist = np.bincount(positions, minlength=22)[1:21]

    gap = np.cumsum(plan_laps) - np.cumsum(real_laps)
    return {
        "driver": driver,
        "plan": format_plan(stints),
        "actual_plan": format_plan(actual_stints),
        "laps": laps,
        "warnings": warnings,
        "stops": len(stints) - 1,
        "hindsight": {
            "delta": num(delta),
            "race_time": num(projected),
            "position": hindsight_pos,
            "actual_position": actual["position"],
        },
        "monte_carlo": {
            "runs": sims,
            "sc_rate": sc,
            "vsc_rate": vsc,
            "delta_mean": num(float(deltas.mean())),
            "delta_p10": num(float(np.percentile(deltas, 10))),
            "delta_p90": num(float(np.percentile(deltas, 90))),
            "better_share": num(float((deltas < 0).mean()), 3),
            "position_mean": num(float(positions.mean()), 2),
            "position_histogram": [
                {"position": p + 1, "share": num(float(c) / sims, 3)}
                for p, c in enumerate(hist)
                if c
            ],
        },
        "laps_detail": [
            {"lap": i + 1, "plan": num(p), "actual": num(a), "gap": num(g)}
            for i, (p, a, g) in enumerate(zip(plan_laps, real_laps, gap))
        ],
    }


def _candidate_plans(model: TyreModel, laps: int, step: int) -> list[list[tuple[str, int, int]]]:
    comps = list(model.compounds)
    min_stint = 6
    plans: list[list[tuple[str, int, int]]] = []
    for c1, c2 in product(comps, repeat=2):
        if not model.wet and c1 == c2:
            continue
        for s in range(min_stint, laps - min_stint + 1):
            plans.append([(c1, s, 0), (c2, laps - s, 0)])
    for c1, c2, c3 in product(comps, repeat=3):
        if not model.wet and len({c1, c2, c3}) < 2:
            continue
        for s1 in range(min_stint, laps - 2 * min_stint + 1, step):
            for s2 in range(s1 + min_stint, laps - min_stint + 1, step):
                plans.append([(c1, s1, 0), (c2, s2 - s1, 0), (c3, laps - s2, 0)])
    return plans


def optimise(
    model: TyreModel, driver: str, conditions: str = "green", top: int = 8
) -> dict[str, Any]:
    """Rank one- and two-stop plans by race time for this driver."""
    actual = _require(model, driver)
    laps = actual["laps"]
    if conditions == "hindsight":
        neutral, times = model.neutral_laps, model.neutral_lap_time
    elif conditions == "green":
        neutral, times = {}, {}
    else:
        raise InvalidParameterError("conditions must be 'green' or 'hindsight'.")

    actual_stints = [
        (c if c in model.compounds else model.reference, n, a) for c, n, a in actual["stints"]
    ]
    real_t, _ = _race_time(model, driver, actual_stints, neutral, times)
    scored = []
    for plan in _candidate_plans(model, laps, step=2):
        t, _ = _race_time(model, driver, plan, neutral, times)
        scored.append((t, plan))
    scored.sort(key=lambda x: x[0])

    # Keep the best plan per (compound sequence) so the list shows real alternatives.
    seen: set[tuple[str, ...]] = set()
    best = []
    for t, plan in scored:
        sig = tuple(c for c, _, _ in plan)
        if sig in seen:
            continue
        seen.add(sig)
        projected = actual["time"] + (t - real_t)
        best.append(
            {
                "plan": format_plan(plan),
                "stops": len(plan) - 1,
                "stints": [{"compound": c, "laps": n} for c, n, _ in plan],
                "pit_laps": [int(x) for x in np.cumsum([n for _, n, _ in plan])[:-1]],
                "delta": num(t - real_t),
                "position": _position(model, driver, laps, projected),
            }
        )
        if len(best) >= top:
            break
    return {
        "driver": driver,
        "conditions": conditions,
        "laps": laps,
        "actual_plan": format_plan(actual_stints),
        "actual_position": actual["position"],
        "evaluated": len(scored),
        "plans": best,
    }


def _gap_at(session: Session, a: str, b: str, lap: int) -> float | None:
    """Seconds car ``a`` is behind car ``b`` crossing the line at the end of ``lap``."""
    laps = session.laps
    ta = laps[(laps["Driver"] == a) & (laps["LapNumber"] == lap)]["Time"]
    tb = laps[(laps["Driver"] == b) & (laps["LapNumber"] == lap)]["Time"]
    if ta.empty or tb.empty or is_missing(ta.iloc[0]) or is_missing(tb.iloc[0]):
        return None
    return float((ta.iloc[0] - tb.iloc[0]).total_seconds())


def _tyre_state(session: Session, code: str, lap: int) -> tuple[str, int]:
    row = session.laps[(session.laps["Driver"] == code) & (session.laps["LapNumber"] == lap)]
    if row.empty:
        raise NotFoundError(f"{code} did not complete lap {lap}.")
    comp = row["Compound"].iloc[0]
    life = row["TyreLife"].iloc[0]
    return (str(comp) if not is_missing(comp) else "MEDIUM", integer(life) or lap)


def _verdict(gap: float, under_ahead: bool, over_ahead: bool) -> str:
    """Read the two scenarios from the attacker's point of view."""
    if gap > 0:  # attacker starts behind
        if under_ahead:
            return "undercut"
        if over_ahead:
            return "overcut"
        return "stay"
    if under_ahead and over_ahead:
        return "safe"
    if under_ahead:
        return "cover"  # must stop first to stay ahead
    if over_ahead:
        return "stay-out"
    return "lose"


def undercut(
    session: Session,
    model: TyreModel,
    attacker: str,
    defender: str,
    lap: int,
    new_compound: str | None = None,
    window: int = 4,
) -> dict[str, Any]:
    """Would pitting ``attacker`` first (undercut) or last (overcut) win the place?

    * Undercut – attacker pits at the end of ``lap``; defender reacts one lap later.
    * Overcut – defender pits at the end of ``lap``; attacker stays out one more lap.

    Each scenario is projected ``window`` laps past the second stop, using the
    fitted pace, compound offset and wear of both cars.
    """
    if attacker == defender:
        raise InvalidParameterError("Pick two different drivers.")
    for code in (attacker, defender):
        _require(model, code)
    total = model.total_laps
    if not 1 <= lap <= total - window - 2:
        raise InvalidParameterError(f"Lap must be between 1 and {total - window - 2}.")
    gap = _gap_at(session, attacker, defender, lap)
    if gap is None:
        raise NotFoundError(f"No timing for both cars at the end of lap {lap}.")

    a_comp, a_age = _tyre_state(session, attacker, lap)
    d_comp, d_age = _tyre_state(session, defender, lap)
    fresh = (new_compound or "").upper() or None

    def pick_fresh(current: str) -> str:
        if fresh:
            model.compound(fresh)
            return fresh
        others = [c for c in model.compounds if c != current]
        if model.viable is not None:
            usable = [c for c in model.compounds if lap + 1 in model.viable.get(c, set())]
            others = [c for c in usable if c != current] or usable
        return min(others or [current], key=lambda c: model.compounds[c].wear)

    def run(code: str, comp: str, age: int, pit_after: int, fresh_comp: str) -> np.ndarray:
        """Lap times from lap+1 for ``window + 2`` laps, pitting after ``pit_after`` laps."""
        m_old = model.compound(comp if comp in model.compounds else model.reference)
        m_new = model.compound(fresh_comp)
        base = model.driver_pace[code]
        times = []
        for k in range(1, window + 3):
            lap_no = lap + k
            if k <= pit_after:
                a = age + k
                over = max(0.0, a - m_old.life)
                t = base + m_old.offset + m_old.wear * a + CLIFF_RATE * over**2
            else:
                a = k - pit_after
                over = max(0.0, a - m_new.life)
                t = base + m_new.offset + m_new.wear * a + CLIFF_RATE * over**2
            t += float(model.lap_term(np.array([lap_no]))[0])
            if model.viable is not None:
                used = comp if k <= pit_after else fresh_comp
                if lap_no not in model.viable.get(used, set()):
                    t += CROSSOVER_PENALTY
            times.append(t)
        arr = np.array(times)
        arr[pit_after] += model.pit_loss if pit_after < len(arr) else 0.0
        return arr

    a_fresh = pick_fresh(a_comp)
    d_fresh = pick_fresh(d_comp)

    def scenario(a_pit_after: int, d_pit_after: int) -> dict[str, Any]:
        # pit_after = 0 means the stop is at the end of `lap` (cost lands on lap+1).
        a = run(attacker, a_comp, a_age, a_pit_after, a_fresh)
        d = run(defender, d_comp, d_age, d_pit_after, d_fresh)
        gaps = gap + np.cumsum(a - d)
        final = float(gaps[-1])
        return {
            "attacker_pits": lap + a_pit_after,
            "defender_pits": lap + d_pit_after,
            "final_gap": num(final),
            "attacker_ahead": final < 0,
            "gaps": [{"lap": lap + k + 1, "gap": num(float(g))} for k, g in enumerate(gaps)],
        }

    under = scenario(0, 1)
    over = scenario(1, 0)
    a_old = model.compound(a_comp if a_comp in model.compounds else model.reference)
    a_new = model.compound(a_fresh)
    tyre_gain = (a_old.offset + a_old.wear * (a_age + 1)) - (a_new.offset + a_new.wear * 1)
    return {
        "attacker": attacker,
        "defender": defender,
        "lap": lap,
        "gap": num(gap),
        "attacker_tyre": {"compound": a_comp, "age": a_age, "next": a_fresh},
        "defender_tyre": {"compound": d_comp, "age": d_age, "next": d_fresh},
        "fresh_tyre_gain": num(tyre_gain),
        "pit_loss": num(model.pit_loss, 2),
        "undercut": under,
        "overcut": over,
        "verdict": _verdict(gap, under["attacker_ahead"], over["attacker_ahead"]),
    }
