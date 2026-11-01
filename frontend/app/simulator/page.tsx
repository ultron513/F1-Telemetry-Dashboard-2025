"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { UndercutView } from "@/components/charts/undercut";
import { Tyre } from "@/components/f1/bits";
import { DriverPicker } from "@/components/shell/pickers";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Button, Empty, QueryView, Segmented, Stat } from "@/components/ui/primitives";
import { useOptimise, useSimulation, useSimulatorModel, useUndercut } from "@/lib/api/queries";
import type { PlanStint, SimulationResponse, SimulatorModelResponse } from "@/lib/api/types";
import { compound } from "@/lib/f1";
import { ordinal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function SimulatorPage() {
  return (
    <SessionGate>
      <Simulator />
    </SessionGate>
  );
}

const SC_LEVELS = {
  none: { sc: 0, vsc: 0, label: "None" },
  low: { sc: 0.3, vsc: 0.2, label: "Low" },
  typical: { sc: 0.55, vsc: 0.35, label: "Typical" },
  high: { sc: 1.1, vsc: 0.6, label: "Chaotic" },
} as const;
type ScLevel = keyof typeof SC_LEVELS;

function planString(stints: PlanStint[]) {
  return stints.map((s) => `${compound(s.compound).short}:${s.laps}${s.start_age ? `:${s.start_age}` : ""}`).join(",");
}

function parsePlan(plan: string): PlanStint[] {
  const full: Record<string, string> = { S: "SOFT", M: "MEDIUM", H: "HARD", I: "INTERMEDIATE", W: "WET" };
  return plan.split(",").map((chunk) => {
    const [c, n, a] = chunk.split(":");
    return { compound: full[c] ?? c, laps: Number(n), start_age: a ? Number(a) : 0 };
  });
}

function Simulator() {
  const { key, driver, vs, set, summary } = useSelection();
  const isRace = summary?.session.kind === "race";
  const model = useSimulatorModel(key, driver, isRace);

  if (!isRace) {
    return (
      <>
        <PageHeader title="Strategy simulator" />
        <Panel>
          <Empty>The simulator models race strategy — switch to the Race or Sprint session.</Empty>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Strategy simulator"
        description="Re-run the race with a different tyre plan. The tyre and fuel model is fitted on this race's own laps, and every plan is compared with what the driver actually did under identical conditions."
        actions={<DriverPicker caption="Driver" value={driver} onChange={(c) => c && set({ driver: c })} className="w-[240px]" />}
      />
      <QueryView query={model}>
        {(m) => (
          // Keyed so a new driver or session starts from what really happened.
          <Workbench key={`${m.season}-${m.round}-${m.session.code}-${m.driver}`} model={m} rival={vs} onRival={(c) => set({ vs: c })} />
        )}
      </QueryView>
    </>
  );
}

function Workbench({ model, rival, onRival }: { model: SimulatorModelResponse; rival: string | null; onRival: (c: string | null) => void }) {
  const { key, driver } = useSelection();
  const laps = model.actual_plan.reduce((a, s) => a + s.laps, 0) || model.total_laps;
  const [stints, setStints] = useState<PlanStint[]>(model.actual_plan);
  const [level, setLevel] = useState<ScLevel>("typical");

  const total = stints.reduce((a, s) => a + s.laps, 0);
  const valid = total === laps && stints.every((s) => s.laps >= 1);
  const [debounced, setDebounced] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(valid ? planString(stints) : null), 250);
    return () => clearTimeout(id);
  }, [stints, valid]);

  const sim = useSimulation(key, driver, debounced, SC_LEVELS[level].sc, SC_LEVELS[level].vsc);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Panel
          accent
          title="Your plan"
          subtitle={`${laps} laps for ${driver}. The last stint absorbs any change so the laps always add up.`}
          actions={
            <Button size="sm" variant="outline" onClick={() => setStints(model.actual_plan)} title="Back to what really happened">
              <RotateCcw className="size-3.5" /> Actual
            </Button>
          }
        >
          <PlanEditor stints={stints} onChange={setStints} laps={laps} compounds={model.compounds.map((c) => c.compound)} />
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1.5 text-[12.5px] text-ink-3">Safety-car risk for the Monte Carlo runs</div>
            <Segmented
              label="Safety-car risk"
              value={level}
              onChange={setLevel}
              size="sm"
              options={(Object.keys(SC_LEVELS) as ScLevel[]).map((k) => ({ value: k, label: SC_LEVELS[k].label }))}
            />
          </div>
        </Panel>
        <Panel share title="Outcome" subtitle="Hindsight replays the real race's safety cars; Monte Carlo draws hundreds of random races.">
          {!valid ? (
            <Empty>The stints cover {total} of {laps} laps.</Empty>
          ) : (
            <QueryView query={sim}>{(s) => <Outcome sim={s} model={model} />}</QueryView>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Optimiser onPick={(plan) => setStints(parsePlan(plan))} />
        <ModelPanel model={model} />
      </div>

      <Undercut model={model} rival={rival} onRival={onRival} />
    </div>
  );
}

function PlanEditor({
  stints,
  onChange,
  laps,
  compounds,
}: {
  stints: PlanStint[];
  onChange: (s: PlanStint[]) => void;
  laps: number;
  compounds: string[];
}) {
  const update = (i: number, patch: Partial<PlanStint>) => {
    const next = stints.map((s, j) => (j === i ? { ...s, ...patch } : { ...s }));
    if (patch.laps != null && i < next.length - 1) {
      const used = next.slice(0, -1).reduce((a, s) => a + s.laps, 0);
      next[next.length - 1].laps = Math.max(1, laps - used);
    }
    onChange(next);
  };
  const add = () => {
    const last = stints[stints.length - 1];
    if (!last || last.laps < 4) return;
    const half = Math.floor(last.laps / 2);
    const nextCompound = compounds.find((c) => c !== last.compound) ?? last.compound;
    onChange([...stints.slice(0, -1), { ...last, laps: last.laps - half }, { compound: nextCompound, laps: half, start_age: 0 }]);
  };
  const remove = (i: number) => {
    if (stints.length < 2) return;
    const next = stints.filter((_, j) => j !== i).map((s) => ({ ...s }));
    const used = next.slice(0, -1).reduce((a, s) => a + s.laps, 0);
    next[next.length - 1].laps = Math.max(1, laps - used);
    onChange(next);
  };

  const starts = stints.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 1 : acc[i - 1] + stints[i - 1].laps], []);
  return (
    <div>
      <PlanStrip stints={stints} laps={laps} />
      <ol className="mt-3 space-y-2.5">
        {stints.map((s, i) => {
          const from = starts[i];
          const isLast = i === stints.length - 1;
          return (
            <li key={i} className="rounded-md border border-line bg-surface-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] text-ink-3">
                  Stint {i + 1} · laps {from}–{from + s.laps - 1}
                </span>
                {stints.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={`Remove stint ${i + 1}`}>
                    <Minus className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {compounds.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update(i, { compound: c })}
                    aria-pressed={s.compound === c}
                    className={cn("rounded-full p-0.5 ring-2 ring-transparent transition", s.compound === c ? "ring-team" : "opacity-55 hover:opacity-100")}
                    title={compound(c).label}
                  >
                    <Tyre compound={c} size={24} />
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="range"
                    min={1}
                    max={laps - (stints.length - 1)}
                    value={s.laps}
                    disabled={isLast}
                    onChange={(e) => update(i, { laps: Number(e.target.value) })}
                    className="w-28 accent-team disabled:opacity-40"
                    aria-label={`Stint ${i + 1} length`}
                  />
                  <span className="tnum w-12 text-right text-ink">{s.laps} laps</span>
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      <Button size="sm" variant="outline" className="mt-3" onClick={add}>
        <Plus className="size-3.5" /> Add a stop
      </Button>
    </div>
  );
}

function PlanStrip({ stints, laps, className }: { stints: PlanStint[]; laps: number; className?: string }) {
  return (
    <div className={cn("flex h-3 w-full overflow-hidden rounded-full bg-surface-3", className)} aria-hidden>
      {stints.map((s, i) => (
        <span
          key={i}
          className="h-full border-r-2 border-surface last:border-r-0"
          style={{ width: `${(s.laps / laps) * 100}%`, background: compound(s.compound).color }}
        />
      ))}
    </div>
  );
}

function signed(v: number | null | undefined, digits = 1) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}`;
}

function Outcome({ sim, model }: { sim: SimulationResponse; model: SimulatorModelResponse }) {
  const h = sim.hindsight;
  const mc = sim.monte_carlo;
  const moved = (h.actual_position ?? h.position) - h.position;
  const gapSeries: LineSeries[] = [
    {
      id: "gap",
      label: "Plan vs actual",
      color: "var(--team-primary)",
      points: sim.laps_detail.map((l) => ({ x: l.lap, y: l.gap })),
      width: 2,
    },
  ];
  const plan = parsePlan(sim.plan);
  const pits = plan.slice(0, -1).reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s.laps], []);
  const actualPits = parsePlan(sim.actual_plan)
    .slice(0, -1)
    .reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s.laps], []);
  const maxShare = Math.max(...mc.position_histogram.map((p) => p.share ?? 0), 0.01);

  return (
    <div className="space-y-4">
      {sim.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-ink">
          {sim.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          emphasis
          label="Finish (hindsight)"
          value={ordinal(h.position)}
          sub={moved === 0 ? `Same as real result` : `${moved > 0 ? "Up" : "Down"} ${Math.abs(moved)} vs real ${ordinal(h.actual_position)}`}
        />
        <Stat label="Race time vs actual" value={signed(h.delta)} unit="s" sub="Real safety cars" />
        <Stat
          label="Monte Carlo average"
          value={signed(mc.delta_mean)}
          unit="s"
          sub={`80% between ${signed(mc.delta_p10)} and ${signed(mc.delta_p90)} s`}
        />
        <Stat
          label="Beats the real plan"
          value={mc.better_share != null ? `${Math.round(mc.better_share * 100)}%` : "—"}
          sub={`of ${mc.runs} random races`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className="mb-1 text-[12.5px] text-ink-3">Cumulative time vs the real strategy (below zero = ahead)</div>
          <LineChart
            ariaLabel="Cumulative gap between the simulated plan and the real strategy"
            series={gapSeries}
            height={220}
            xLabel="Lap"
            yFormat={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}s`}
            tooltipX={(v) => `Lap ${v}`}
            refLines={[{ y: 0, label: "Real" }]}
            vMarkers={[
              ...pits.map((p) => ({ x: p, label: actualPits.includes(p) ? "Stop" : "Plan stop", color: "var(--team-primary)" })),
              ...actualPits.filter((p) => !pits.includes(p)).map((p) => ({ x: p, label: "Real stop", color: "var(--ink-3)" })),
            ]}
            bands={model.neutralised.map((n) => ({ from: n.lap - 1, to: n.lap, color: "rgba(245,158,11,0.12)", label: n.kind }))}
          />
        </div>
        <div>
          <div className="mb-2 text-[12.5px] text-ink-3">Finishing position across random races</div>
          <ul className="space-y-1">
            {mc.position_histogram.map((p) => (
              <li key={p.position} className="grid grid-cols-[2.25rem_1fr_2.5rem] items-center gap-2 text-[12.5px]">
                <span className="tnum text-ink-2">{ordinal(p.position)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full bg-team" style={{ width: `${((p.share ?? 0) / maxShare) * 100}%` }} />
                </span>
                <span className="tnum text-right text-ink">{Math.round((p.share ?? 0) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Optimiser({ onPick }: { onPick: (plan: string) => void }) {
  const { key, driver } = useSelection();
  const [conditions, setConditions] = useState<"green" | "hindsight">("green");
  const opt = useOptimise(key, driver, conditions);
  return (
    <Panel
      title="Optimal strategies"
      subtitle="Every one- and two-stop plan, ranked. Select one to load it into the planner."
      actions={
        <Segmented
          label="Race conditions"
          size="sm"
          value={conditions}
          onChange={setConditions}
          options={[
            { value: "green", label: "Green race", title: "No safety cars" },
            { value: "hindsight", label: "Hindsight", title: "Knows when the real safety cars came" },
          ]}
        />
      }
    >
      <QueryView query={opt}>
        {(o) => (
          <>
            <p className="mb-2 text-[12.5px] text-ink-3">
              {o.evaluated.toLocaleString()} plans evaluated · real plan finished {ordinal(o.actual_position)}
            </p>
            <ul className="divide-y divide-line">
              {o.plans.map((p, i) => (
                <li key={p.plan}>
                  <button
                    type="button"
                    onClick={() => onPick(p.plan)}
                    className="grid w-full grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_3rem] items-center gap-3 py-2 text-left text-[13px] hover:bg-surface-2"
                  >
                    <span className="tnum text-ink-3">{i + 1}</span>
                    <span className="min-w-0">
                      <PlanStrip stints={p.stints} laps={o.laps} />
                      <span className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-ink-3">
                        {p.stops}-stop · pit {p.pit_laps.map((l) => `L${l}`).join(", ")}
                      </span>
                    </span>
                    <span className={cn("tnum text-right", (p.delta ?? 0) < 0 ? "text-good" : "text-ink-2")}>{signed(p.delta)}s</span>
                    <span className="tnum text-right text-ink">{ordinal(p.position)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryView>
    </Panel>
  );
}

function ModelPanel({ model }: { model: SimulatorModelResponse }) {
  const series: LineSeries[] = useMemo(
    () =>
      model.compounds.map((c) => ({
        id: c.compound,
        label: `${compound(c.compound).label}${c.source === "fitted" ? "" : ` (${c.source})`}`,
        color: compound(c.compound).color,
        dashed: c.source !== "fitted",
        points: c.points.map((p) => ({ x: p.age, y: p.delta })),
        width: 2,
      })),
    [model.compounds],
  );
  return (
    <Panel share title="Tyre model" subtitle={`Lap-time cost vs a new ${compound(model.reference).label.toLowerCase()}, by tyre age. Dashed lines are not fitted from this race.`}>
      <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Pit loss" value={model.pit_loss?.toFixed(1) ?? "—"} unit="s" sub={model.pit_loss_source} />
        <Stat label="Fuel effect" value={model.fuel_effect != null ? (model.fuel_effect * 1000).toFixed(0) : "—"} unit="ms/lap" sub="Lighter car, faster lap" />
        <Stat label="Model fit" value={model.fit_r2 != null ? `R² ${model.fit_r2.toFixed(2)}` : "—"} sub={`±${model.lap_noise?.toFixed(2) ?? "—"} s lap noise`} />
        <Stat label="Neutralised laps" value={model.neutralised.length} sub={model.mixed_conditions ? "Mixed wet/dry race" : "Safety car + VSC"} />
      </div>
      <LineChart
        ariaLabel="Lap-time cost by tyre age for each compound"
        series={series}
        height={220}
        xLabel="Tyre age (laps)"
        yFormat={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}s`}
        tooltipX={(v) => `Age ${v}`}
      />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
        {model.compounds.map((c) => (
          <li key={c.compound} className="flex items-center gap-1.5">
            <Tyre compound={c.compound} size={16} />
            <span className="tnum">
              {c.wear != null ? `${(c.wear * 1000).toFixed(0)} ms/lap` : "—"} · life ~{c.life?.toFixed(0)} laps
            </span>
            {model.mixed_conditions && model.viable_laps[c.compound]?.length ? (
              <span className="text-ink-3">· usable L{model.viable_laps[c.compound].map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(", L")}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Undercut({ model, rival, onRival }: { model: SimulatorModelResponse; rival: string | null; onRival: (c: string | null) => void }) {
  const { key, driver } = useSelection();
  const [lap, setLap] = useState(() => Math.round(model.total_laps * 0.35));
  const [debouncedLap, setDebouncedLap] = useState(lap);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedLap(lap), 200);
    return () => clearTimeout(id);
  }, [lap]);
  const q = useUndercut(key, driver, rival, debouncedLap);
  const maxLap = model.total_laps - 6;

  return (
    <Panel share
      title="Undercut / overcut calculator"
      subtitle={`Should ${driver} pit before or after a rival? Projects both cars four laps past the second stop.`}
      actions={
        <>
          <DriverPicker caption="Rival" value={rival} exclude={driver} onChange={(c) => onRival(c)} className="w-[220px]" />
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            Decision on lap
            <input type="range" min={2} max={maxLap} value={lap} onChange={(e) => setLap(Number(e.target.value))} className="w-36 accent-team" aria-label="Decision lap" />
            <span className="tnum w-6 text-ink">{lap}</span>
          </label>
        </>
      }
    >
      {!rival ? <Empty>Pick a rival to compare pit timing.</Empty> : <QueryView query={q}>{(u) => <UndercutView u={u} />}</QueryView>}
    </Panel>
  );
}
