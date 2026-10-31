"use client";

import { useMemo, useState } from "react";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { BarList } from "@/components/charts/misc-charts";
import { StrategyGantt } from "@/components/charts/strategy-gantt";
import { TeamStripe, Tyre } from "@/components/f1/bits";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Empty, QueryView, Segmented, Stat } from "@/components/ui/primitives";
import { useDegradation, useRaceTrace, useRecommendation, useStrategy } from "@/lib/api/queries";
import type { RecommendationResponse, StintVerdict } from "@/lib/api/types";
import { compound } from "@/lib/f1";
import { lapTime } from "@/lib/format";
import { seriesStyles, teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function StrategyPage() {
  return (
    <SessionGate>
      <Strategy />
    </SessionGate>
  );
}

const VERDICT: Record<StintVerdict, { label: string; tone: "good" | "warn" | "bad" | "muted"; text: (n: number, opt: number | null) => string }> = {
  "on-target": { label: "On target", tone: "good", text: (n, o) => `${n} laps against a modelled optimum of ${o?.toFixed(0)} — degradation and pit loss were balanced.` },
  overextended: { label: "Ran long", tone: "bad", text: (n, o) => `${n} laps, beyond the ~${o?.toFixed(0)}-lap point where tyre loss outweighed a stop.` },
  early: { label: "Stopped early", tone: "warn", text: (n, o) => `${n} laps; the tyres could have gone ~${o?.toFixed(0)}. Likely an undercut or a track-position call.` },
  "deg-not-limiting": { label: "Tyres not limiting", tone: "good", text: () => "Degradation was too low to force a stop — the compound rule or traffic decided this one." },
  "no-degradation": { label: "No measurable wear", tone: "good", text: () => "Fuel burn masked any tyre wear; lap times held or improved." },
  "insufficient-data": { label: "Not enough laps", tone: "muted", text: () => "Too few clean laps to model this stint." },
};

const TONE = { good: "text-good", warn: "text-warn", bad: "text-bad", muted: "text-ink-3" } as const;

function Strategy() {
  const { key, driver, summary, set } = useSelection();
  const strategy = useStrategy(key);
  const isRace = summary?.session.kind === "race";
  const trace = useRaceTrace(isRace ? key : null);

  return (
    <>
      <PageHeader
        title="Strategy"
        description="How every car's tyres were used, what each stop cost, how fast the rubber faded and how the order moved lap by lap."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel accent title="Tyre strategy" subtitle="New sets are solid, used sets hatched. Select a row to focus that driver." flush bodyClassName="px-2 pb-3">
          <QueryView query={strategy}>
            {(s) => <StrategyGantt data={s} lapStatus={trace.data?.lap_status} focus={driver} onSelect={(c) => set({ driver: c })} />}
          </QueryView>
        </Panel>
        <div className="space-y-4">
          <PitCall />
          <QueryView query={strategy}>
            {(s) => (
              <Panel title="Compound wear" subtitle="Field median, fuel-corrected">
                {Object.keys(s.compound_degradation).length === 0 ? (
                  <Empty>Not enough clean stints to model wear.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {Object.entries(s.compound_degradation).map(([c, v]) => (
                      <li key={c} className="flex items-center gap-3 text-[13.5px]">
                        <Tyre compound={c} size={20} />
                        <span className="flex-1">{compound(c).label}</span>
                        <span className="tnum">{v != null ? `${v > 0 ? "+" : ""}${(v * 1000).toFixed(0)} ms/lap` : "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </QueryView>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DegradationPanel />
        <PitStopsPanel />
      </div>

      {isRace && (
        <div className="mt-4">
          <RaceTracePanel />
        </div>
      )}
    </>
  );
}

function PitCall() {
  const { key, driver } = useSelection();
  const rec = useRecommendation(key, driver);
  return (
    <Panel title="Pit wall review" subtitle={driver ? `${driver}'s stints against a degradation model` : undefined}>
      <QueryView query={rec}>{(r) => <PitCallBody r={r} />}</QueryView>
    </Panel>
  );
}

function PitCallBody({ r }: { r: RecommendationResponse }) {
  const riskTone = r.risk === "high" ? "bad" : r.risk === "medium" ? "warn" : r.risk === "low" ? "good" : "muted";
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pit loss" value={`${r.pit_loss.toFixed(1)}s`} sub={r.pit_loss_source === "measured" ? "Measured from in/out laps" : "Estimated"} />
        <Stat label="Tyre risk" value={<span className={cn("capitalize", TONE[riskTone])}>{r.risk}</span>} sub="Worst stint wear" />
      </div>
      <ol className="mt-3 space-y-2.5 border-t border-line pt-3">
        {r.stints.map((s) => {
          const v = VERDICT[s.verdict];
          return (
            <li key={s.stint} className="flex gap-3">
              <Tyre compound={s.compound} size={22} />
              <div className="min-w-0">
                <div className="text-[13.5px]">
                  <span className="font-semibold">Stint {s.stint}</span>{" "}
                  <span className={cn("font-semibold", TONE[v.tone])}>{v.label}</span>
                  {s.degradation != null && <span className="tnum ml-2 text-xs text-ink-3">{(s.degradation * 1000).toFixed(0)} ms/lap</span>}
                </div>
                <p className="text-[13px] leading-snug text-ink-2">{v.text(s.laps, s.optimal_length)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-3">
        Optimal stint ≈ √(2 × pit loss ÷ wear rate), with lap times corrected for fuel burn. A model, not the team&rsquo;s call.
      </p>
    </>
  );
}

function DegradationPanel() {
  const { key, driver, focus } = useSelection();
  const deg = useDegradation(key, driver);
  const [corrected, setCorrected] = useState(true);
  return (
    <Panel
      title="Tyre degradation"
      subtitle={`${driver ?? ""} lap time against tyre age, per stint`}
      actions={
        <Segmented
          size="sm"
          label="Lap time basis"
          value={corrected ? "fuel" : "raw"}
          onChange={(v) => setCorrected(v === "fuel")}
          options={[
            { value: "fuel", label: "Fuel-corrected" },
            { value: "raw", label: "Raw" },
          ]}
        />
      }
    >
      <QueryView query={deg}>
        {(d) => {
          const series: LineSeries[] = [];
          d.stints.forEach((s) => {
            const c = compound(s.compound);
            series.push({
              id: `s${s.stint}`,
              label: `Stint ${s.stint}`,
              color: c.color,
              kind: "dots",
              points: s.laps.map((l) => ({ x: l.tyre_life ?? 0, y: corrected ? l.fuel_corrected : l.time, meta: `L${l.lap}` })),
            });
            const slope = corrected ? s.fuel_corrected_slope : s.slope;
            const icpt = corrected ? s.fuel_corrected_intercept : s.intercept;
            const ages = s.laps.map((l) => l.tyre_life ?? 0);
            if (slope != null && icpt != null && ages.length > 1) {
              const lo = Math.min(...ages);
              const hi = Math.max(...ages);
              series.push({ id: `f${s.stint}`, label: `Fit ${s.stint}`, color: c.color, dashed: true, width: 1.5, points: [{ x: lo, y: icpt + slope * lo }, { x: hi, y: icpt + slope * hi }] });
            }
          });
          if (!series.length) return <Empty>No clean laps to model for {focus?.code}.</Empty>;
          return (
            <>
              <LineChart series={series} height={280} yFormat={(v) => lapTime(v, 1)} tooltipX={(v) => `Tyre age ${v} laps`} xLabel="tyre age (laps)" ariaLabel="Lap time against tyre age" />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                {d.stints.map((s) => {
                  const k = corrected ? s.fuel_corrected_slope : s.slope;
                  return (
                    <span key={s.stint} className="inline-flex items-center gap-1.5">
                      <Tyre compound={s.compound} size={14} /> Stint {s.stint}:{" "}
                      <span className="tnum text-ink">{k != null ? `${k > 0 ? "+" : ""}${(k * 1000).toFixed(0)} ms/lap` : "—"}</span>
                    </span>
                  );
                })}
              </div>
            </>
          );
        }}
      </QueryView>
    </Panel>
  );
}

function PitStopsPanel() {
  const { key, driver } = useSelection();
  const strategy = useStrategy(key);
  return (
    <Panel title="Pit stops" subtitle="Time in the pit lane, entry line to exit line">
      <QueryView query={strategy}>
        {(s) =>
          s.pit_stops.length === 0 ? (
            <Empty>No pit stops in this session.</Empty>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Stat label="Stops" value={s.pit_stops.length} />
                <Stat label="Median lane time" value={s.median_pit_lane != null ? `${s.median_pit_lane.toFixed(2)}s` : "—"} />
                <Stat label="Quickest" value={s.fastest_pit_lane?.pit_lane_time != null ? `${s.fastest_pit_lane.pit_lane_time.toFixed(2)}s` : "—"} sub={s.fastest_pit_lane ? `${s.fastest_pit_lane.code}, lap ${s.fastest_pit_lane.lap}` : undefined} />
              </div>
              <BarList
                lowerIsBetter
                format={(v) => `${v.toFixed(2)}s`}
                rows={[...s.pit_stops]
                  .filter((p) => p.pit_lane_time != null)
                  .sort((a, b) => (a.pit_lane_time ?? 0) - (b.pit_lane_time ?? 0))
                  .slice(0, 12)
                  .map((p) => ({
                    id: `${p.code}-${p.stop}`,
                    value: p.pit_lane_time as number,
                    color: p.code === driver ? "var(--team-primary)" : teamColor(p.team, p.team_color),
                    label: (
                      <>
                        <TeamStripe team={p.team} color={p.team_color} />
                        <span className={cn("font-semibold", p.code === driver && "text-team")}>{p.code}</span>
                        <span className="tnum text-xs text-ink-3">L{p.lap}</span>
                        <Tyre compound={p.to_compound} size={14} />
                        {p.under && <span className="text-[10.5px] font-semibold text-warn">{p.under}</span>}
                      </>
                    ),
                  }))}
              />
            </>
          )
        }
      </QueryView>
    </Panel>
  );
}

function RaceTracePanel() {
  const { key, driver, vs } = useSelection();
  const trace = useRaceTrace(key);
  const [view, setView] = useState<"position" | "gap">("position");
  const highlight = useMemo(() => new Set([driver, vs].filter(Boolean) as string[]), [driver, vs]);
  return (
    <Panel
      title="Race trace"
      subtitle={view === "position" ? "Running order at the end of every lap; focus and comparison drivers highlighted" : "Seconds behind the leader at the end of every lap"}
      actions={
        <Segmented
          size="sm"
          label="Race trace view"
          value={view}
          onChange={setView}
          options={[
            { value: "position", label: "Positions" },
            { value: "gap", label: "Gap to leader" },
          ]}
        />
      }
    >
      <QueryView query={trace}>
        {(t) => {
          const styles = seriesStyles(t.drivers);
          const series: LineSeries[] = t.drivers.map((d) => ({
            id: d.code,
            label: d.code,
            color: styles.get(d.code)?.color ?? teamColor(d.team, d.team_color),
            dashed: styles.get(d.code)?.dashed,
            width: highlight.has(d.code) ? 3 : 1.6,
            points: d.points.map((p) => ({ x: p.lap, y: view === "position" ? p.position : p.gap != null ? Math.min(p.gap, 120) : null })),
          }));
          return (
            <LineChart
              series={series}
              height={view === "position" ? 460 : 380}
              invertY={view === "position" || view === "gap"}
              yDomain={view === "position" ? [0.5, t.drivers.length + 0.5] : undefined}
              yTicks={view === "position" ? [1, 5, 10, 15, 20].filter((v) => v <= t.drivers.length) : undefined}
              yFormat={(v) => (view === "position" ? `P${Math.round(v)}` : `+${v.toFixed(0)}s`)}
              tooltipX={(v) => `Lap ${v}`}
              highlight={highlight}
              endLabels
              xLabel="lap"
              ariaLabel="Race trace"
            />
          );
        }}
      </QueryView>
    </Panel>
  );
}
