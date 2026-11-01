from __future__ import annotations

from app.schemas.common import Model, SessionContext


class CurvePoint(Model):
    age: int
    delta: float | None = None


class CompoundCurve(Model):
    compound: str
    offset: float | None = None
    wear: float | None = None
    life: float | None = None
    samples: int
    source: str
    points: list[CurvePoint]


class DriverPace(Model):
    code: str
    pace: float | None = None
    gap: float | None = None


class PlanStint(Model):
    compound: str
    laps: int
    start_age: int = 0


class Neutralised(Model):
    lap: int
    kind: str


class SimulatorModelResponse(SessionContext):
    reference: str
    total_laps: int
    fuel_effect: float | None = None
    pit_loss: float | None = None
    pit_loss_source: str
    lap_noise: float | None = None
    fit_r2: float | None = None
    wet: bool
    mixed_conditions: bool
    viable_laps: dict[str, list[list[int]]]
    neutralised: list[Neutralised]
    compounds: list[CompoundCurve]
    driver_pace: list[DriverPace]
    driver: str | None = None
    actual_plan: list[PlanStint]


class Hindsight(Model):
    delta: float | None = None
    race_time: float | None = None
    position: int
    actual_position: int | None = None


class PositionShare(Model):
    position: int
    share: float | None = None


class MonteCarlo(Model):
    runs: int
    sc_rate: float
    vsc_rate: float
    delta_mean: float | None = None
    delta_p10: float | None = None
    delta_p90: float | None = None
    better_share: float | None = None
    position_mean: float | None = None
    position_histogram: list[PositionShare]


class SimLap(Model):
    lap: int
    plan: float | None = None
    actual: float | None = None
    gap: float | None = None


class SimulationResponse(SessionContext):
    driver: str
    plan: str
    actual_plan: str
    laps: int
    warnings: list[str]
    stops: int
    hindsight: Hindsight
    monte_carlo: MonteCarlo
    laps_detail: list[SimLap]


class RankedPlan(Model):
    plan: str
    stops: int
    stints: list[PlanStint]
    pit_laps: list[int]
    delta: float | None = None
    position: int


class OptimiseResponse(SessionContext):
    driver: str
    conditions: str
    laps: int
    actual_plan: str
    actual_position: int | None = None
    evaluated: int
    plans: list[RankedPlan]


class TyreState(Model):
    compound: str
    age: int
    next: str


class GapPoint(Model):
    lap: int
    gap: float | None = None


class PitScenario(Model):
    attacker_pits: int
    defender_pits: int
    final_gap: float | None = None
    attacker_ahead: bool
    gaps: list[GapPoint]


class UndercutResponse(SessionContext):
    attacker: str
    defender: str
    lap: int
    gap: float | None = None
    attacker_tyre: TyreState
    defender_tyre: TyreState
    fresh_tyre_gain: float | None = None
    pit_loss: float | None = None
    undercut: PitScenario
    overcut: PitScenario
    verdict: str
