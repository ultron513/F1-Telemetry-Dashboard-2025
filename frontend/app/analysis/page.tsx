"use client";

import { useMemo, useState } from "react";

import { RatingRadar } from "@/components/charts/misc-charts";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { TeamStripe } from "@/components/f1/bits";
import { DriverPicker } from "@/components/shell/pickers";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Empty, QueryView, Segmented, Stat } from "@/components/ui/primitives";
import { useCars, useIdealLap, useStyle, useTyreManagement } from "@/lib/api/queries";
import type { CarsResponse, IdealLapResponse, StyleResponse, TyreManagementResponse } from "@/lib/api/types";
import { lapTime } from "@/lib/format";
import { seriesStyles, teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function AnalysisPage() {
  return (
    <SessionGate>
      <Analysis />
    </SessionGate>
  );
}

function Analysis() {
  const { key, driver, vs, set, summary } = useSelection();
  const isRace = summary?.session.kind === "race";
  const codes = useMemo(() => [driver, vs].filter((c): c is string => !!c), [driver, vs]);
  const style = useStyle(key, codes);
  const ideal = useIdealLap(key, driver);
  const cars = useCars(key);
  const tyres = useTyreManagement(key, isRace);

  return (
    <>
      <PageHeader
        title="Driver & car analysis"
        description="How each driver attacks the corners, the lap they had in them, what each car is built for and who looks after their tyres — all from each car's own telemetry."
        actions={
          <>
            <DriverPicker caption="Driver" value={driver} onChange={(c) => c && set({ driver: c })} className="w-[220px]" />
            <DriverPicker caption="Compare with" value={vs} exclude={driver} allowNone onChange={(c) => set({ vs: c })} className="w-[220px]" />
          </>
        }
      />
      <div className="space-y-4">
        <QueryView query={style}>{(s) => <StyleSection data={s} />}</QueryView>
        <div className="grid gap-4 xl:grid-cols-2">
          <QueryView query={ideal}>{(d) => <IdealLap data={d} />}</QueryView>
          <QueryView query={cars}>{(d) => <Cars data={d} />}</QueryView>
        </div>
        {isRace && <QueryView query={tyres}>{(d) => <Tyres data={d} focus={driver} />}</QueryView>}
      </div>
    </>
  );
}

function fmt(v: number | null | undefined, digits = 0, unit = "") {
  return v == null ? "—" : `${v.toFixed(digits)}${unit}`;
}

function StyleSection({ data }: { data: StyleResponse }) {
  const [a, b] = data.drivers;
  const styles = seriesStyles(data.drivers);
  const [band, setBand] = useState<"all" | "slow" | "medium" | "fast">("all");
  if (!a) return null;
  const sa = styles.get(a.code)!;
  const sb = b ? styles.get(b.code)! : null;
  const bCorners = new Map((b?.corners ?? []).map((c) => [`${c.number}${c.letter}`, c]));
  const corners = a.corners.filter((c) => band === "all" || c.class === band);

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Panel share accent title="Driving style" subtitle={`Percentile against the field's ${data.field_size} fastest laps (100 = best on that axis).`}>
        <RatingRadar
          floor={0}
          axes={data.axes.map((ax) => ({ key: ax.key, label: ax.label.replace("-corner speed", " corners") }))}
          a={{ label: a.code, color: sa.color, scores: a.scores }}
          b={b && sb ? { label: b.code, color: sb.color, scores: b.scores, dashed: sb.dashed } : undefined}
        />
        <ul className="mt-3 space-y-1.5 text-[13px]">
          {data.axes.map((ax) => (
            <li key={ax.key} className="grid grid-cols-[minmax(0,1fr)_3rem_3rem] items-center gap-2" title={ax.description}>
              <span className="truncate text-ink-2">{ax.label}</span>
              <span className="tnum text-right" style={{ color: sa.color }}>
                {fmt(a.scores[ax.key])}
              </span>
              <span className="tnum text-right text-ink-3">{b ? fmt(b.scores[ax.key]) : ""}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel
        title="Corner by corner"
        subtitle={`${a.code}${b ? ` vs ${b.code}` : ""} on their fastest laps. Braking is metres before the apex; pick-up is metres after it to full throttle.`}
        actions={
          <Segmented
            label="Corner speed"
            size="sm"
            value={band}
            onChange={setBand}
            options={[
              { value: "all", label: "All" },
              { value: "slow", label: "Slow" },
              { value: "medium", label: "Medium" },
              { value: "fast", label: "Fast" },
            ]}
          />
        }
        flush
        bodyClassName="pb-2"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-3 uppercase">
                <th className="py-2 pl-5 font-medium">Turn</th>
                <th className="py-2 text-right font-medium">Braking</th>
                <th className="py-2 text-right font-medium">Entry</th>
                <th className="py-2 text-right font-medium">Apex</th>
                <th className="py-2 text-right font-medium">Exit</th>
                <th className="py-2 text-right font-medium">Gear</th>
                <th className="py-2 text-right font-medium">Pick-up</th>
                {b && <th className="py-2 pr-5 text-right font-medium">Time vs {b.code}</th>}
              </tr>
            </thead>
            <tbody>
              {corners.map((c) => {
                const o = bCorners.get(`${c.number}${c.letter}`);
                const dt = o && c.time != null && o.time != null ? c.time - o.time : null;
                const pair = (va: number | null, vb: number | null | undefined, digits = 0, lowerBetter = false) => {
                  const better = vb != null && va != null && (lowerBetter ? va < vb : va > vb);
                  return (
                    <span className="inline-flex items-baseline justify-end gap-1.5">
                      <span className={cn("text-ink", better && "font-semibold")}>{fmt(va, digits)}</span>
                      {o && <span className="text-[11.5px] text-ink-3">{fmt(vb ?? null, digits)}</span>}
                    </span>
                  );
                };
                return (
                  <tr key={`${c.number}${c.letter}`} className="border-b border-line/60">
                    <td className="py-1.5 pl-5">
                      <span className="font-semibold text-ink">T{c.number}{c.letter}</span>{" "}
                      <span className="text-[11.5px] text-ink-3">{c.class}</span>
                    </td>
                    <td className="tnum py-1.5 text-right">{c.braked ? pair(c.brake_point, o?.brake_point, 0, true) : <span className="text-ink-3">lift</span>}</td>
                    <td className="tnum py-1.5 text-right">{pair(c.entry_speed, o?.entry_speed)}</td>
                    <td className="tnum py-1.5 text-right">{pair(c.apex_speed, o?.apex_speed)}</td>
                    <td className="tnum py-1.5 text-right">{pair(c.exit_speed, o?.exit_speed)}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{c.gear}</td>
                    <td className="tnum py-1.5 text-right">{pair(c.throttle_pickup, o?.throttle_pickup, 0, true)}</td>
                    {b && (
                      <td className={cn("tnum py-1.5 pr-5 text-right", dt == null ? "text-ink-3" : dt < 0 ? "text-good" : "text-bad")}>
                        {dt == null ? "—" : `${dt > 0 ? "+" : "−"}${Math.abs(dt).toFixed(3)}`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {corners.length === 0 && <Empty>No {band} corners at this track.</Empty>}
        </div>
      </Panel>
    </div>
  );
}

function IdealLap({ data }: { data: IdealLapResponse }) {
  const max = Math.max(0.05, ...data.minisectors.map((m) => Math.abs(m.loss ?? 0)));
  const color = teamColor(data.driver.team, data.driver.team_color);
  return (
    <Panel share
      title={`Ideal lap · ${data.driver.code}`}
      subtitle={`Best sector times stitched together, across ${data.laps_used.length} quick laps. Bars show where lap ${data.fastest_lap.lap} lost (up) or found (down) time.`}
    >
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Fastest lap" value={lapTime(data.fastest_lap.time)} sub={`Lap ${data.fastest_lap.lap}`} />
        <Stat emphasis label="Ideal lap" value={lapTime(data.ideal_time)} />
        <Stat label="Left on the table" value={data.gain != null ? data.gain.toFixed(3) : "—"} unit="s" />
      </div>
      <svg viewBox="0 0 500 120" className="mt-4 w-full" role="img" aria-label="Time lost per mini-sector on the fastest lap">
        <line x1={0} x2={500} y1={60} y2={60} stroke="var(--chart-grid)" />
        {data.minisectors.map((m, i) => {
          const w = 500 / data.minisectors.length;
          const h = (Math.abs(m.loss ?? 0) / max) * 54;
          const up = (m.loss ?? 0) > 0;
          const first = i > 0 && data.minisectors[i - 1].sector !== m.sector;
          return (
            <g key={m.index}>
              {first && (
                <>
                  <line x1={i * w} x2={i * w} y1={4} y2={116} stroke="var(--ink-3)" strokeDasharray="2 3" />
                  <text x={i * w + 4} y={114} fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-sans)">
                    S{m.sector}
                  </text>
                </>
              )}
              <rect x={i * w + 2} y={up ? 60 - h : 60} width={w - 4} height={Math.max(1, h)} rx={2} fill={up ? "var(--bad)" : color} opacity={0.85}>
                <title>{`Mini-sector ${m.index + 1} (S${m.sector}): ${(m.loss ?? 0) > 0 ? "lost" : "gained"} ${Math.abs(m.loss ?? 0).toFixed(3)} s · best on lap ${m.best_lap}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11.5px] text-ink-3">
        <span>Start / finish</span>
        <span>Line</span>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 text-[12.5px] text-ink-3">Theoretical best — every driver</div>
        <ol className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
          {data.field.slice(0, 10).map((f, i) => (
            <li key={f.code} className="grid grid-cols-[1.25rem_auto_1fr_auto] items-center gap-2">
              <span className="tnum text-ink-3">{i + 1}</span>
              <TeamStripe team={f.team} color={f.team_color} />
              <span className="font-medium text-ink">{f.code}</span>
              <span className="tnum text-ink-2">
                {lapTime(f.theoretical)} <span className="text-[11.5px] text-ink-3">−{f.gain?.toFixed(3)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

function Cars({ data }: { data: CarsResponse }) {
  const series: LineSeries[] = data.teams.map((t) => ({
    id: t.team,
    label: t.team,
    color: teamColor(t.team, t.team_color),
    kind: "dots",
    points: [{ x: t.speed_trap ?? 0, y: t.corner_index ?? 0, meta: t.profile }],
  }));
  return (
    <Panel share title="What each car is built for" subtitle="Speed trap vs cornering speed, from each team's quickest lap. Top right is fast everywhere.">
      <LineChart
        ariaLabel="Straight-line speed against cornering speed by team"
        series={series}
        height={250}
        xFormat={(v) => `${v.toFixed(0)}`}
        yFormat={(v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))}
        tooltipX={(v) => `${v.toFixed(0)} km/h speed trap`}
        xLabel="Speed trap (km/h)"
        refLines={[{ y: 0, label: "Field average cornering" }]}
      />
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
        {data.teams.map((t) => (
          <li key={t.team} className="flex items-center gap-2">
            <TeamStripe team={t.team} color={t.team_color} />
            <span className="min-w-0 flex-1 truncate text-ink">{t.team}</span>
            <span
              className={cn(
                "rounded px-1.5 py-px text-[11.5px]",
                t.profile === "Low drag" ? "bg-surface-3 text-ink-2" : t.profile === "High downforce" ? "bg-team/20 text-ink" : "text-ink-3",
              )}
            >
              {t.profile}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Tyres({ data, focus }: { data: TyreManagementResponse; focus: string | null }) {
  return (
    <Panel
      title="Tyre management"
      subtitle="Fuel-corrected wear against the field median on the same compound (70%) and lap-time consistency within a stint (30%)."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ul className="space-y-1.5">
          {data.drivers.map((d, i) => (
            <li key={d.code} className={cn("grid grid-cols-[1.5rem_3rem_1fr_3rem_6rem] items-center gap-3 rounded px-1 text-[13px]", d.code === focus && "bg-surface-2")}>
              <span className="tnum text-ink-3">{i + 1}</span>
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <TeamStripe team={d.team} color={d.team_color} />
                {d.code}
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, d.score)}%`, background: teamColor(d.team, d.team_color) }} />
              </span>
              <span className="tnum text-right text-ink">{d.score.toFixed(0)}</span>
              <span className="tnum text-right text-[12px] text-ink-3">
                {d.relative_degradation != null ? `${d.relative_degradation > 0 ? "+" : ""}${(d.relative_degradation * 1000).toFixed(0)} ms/lap` : "—"}
              </span>
            </li>
          ))}
        </ul>
        <div>
          <div className="mb-2 text-[12.5px] text-ink-3">Team-mate gaps</div>
          <ul className="space-y-2 text-[13px]">
            {data.teammates.map((t) => (
              <li key={t.team ?? t.drivers.join()} className="flex items-center justify-between gap-3">
                <span className="text-ink-2">
                  <strong className="text-ink">{t.drivers[0]}</strong> vs {t.drivers[1]}
                </span>
                <span className="tnum text-ink">+{t.delta?.toFixed(0)}</span>
              </li>
            ))}
            {data.teammates.length === 0 && <Empty>No team with two rated drivers.</Empty>}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
