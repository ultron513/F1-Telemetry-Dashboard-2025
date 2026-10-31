"use client";

import Link from "next/link";

import { RatingRadar } from "@/components/charts/misc-charts";
import { TeamStripe } from "@/components/f1/bits";
import { DriverAvatar } from "@/components/f1/driver-avatar";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { DriverPicker } from "@/components/shell/pickers";
import { Panel } from "@/components/ui/panel";
import { Empty, QueryView } from "@/components/ui/primitives";
import { useCompare, useRatings } from "@/lib/api/queries";
import type { DriverInfo, RatingsResponse, TelemetryStats } from "@/lib/api/types";
import { lapTime, sectorTime, speed, speedUnitLabel } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";

export default function PerformancePage() {
  return (
    <SessionGate>
      <HeadToHead />
    </SessionGate>
  );
}

function rawFormat(key: string, v: number | null | undefined): string {
  if (v == null) return "—";
  switch (key) {
    case "one_lap":
    case "race_pace":
      return `+${v.toFixed(2)}%`;
    case "consistency":
      return `${v.toFixed(3)}s`;
    case "top_speed":
      return `${v.toFixed(0)} km/h`;
    case "tyre_management":
      return `${(v * 1000).toFixed(0)} ms/lap`;
    case "racecraft":
      return `${v > 0 ? "+" : ""}${v.toFixed(0)} places`;
    default:
      return v.toFixed(2);
  }
}

function HeadToHead() {
  const { key, driver, vs, set, focus, rival, queryString } = useSelection();
  const ratings = useRatings(key);
  const colorA = teamColor(focus?.team, focus?.team_color);
  const sameTeam = rival?.team === focus?.team;
  const colorB = rival ? (sameTeam ? "var(--teammate)" : teamColor(rival.team, rival.team_color)) : "#888";

  return (
    <>
      <PageHeader
        title="Head to head"
        description="Two drivers measured on the same session: data-driven ratings across the field, then their best laps side by side."
        actions={
          <Link href={`/telemetry?${queryString}`} className="text-sm text-ink-2 underline-offset-4 hover:text-team hover:underline">
            Open the full telemetry overlay
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DriverPicker caption="Driver" value={driver} onChange={(c) => c && set({ driver: c })} className="w-[240px]" />
        <span className="px-1 text-sm font-semibold text-ink-3 italic">vs</span>
        <DriverPicker caption="Rival" value={vs} exclude={driver} onChange={(c) => set({ vs: c })} className="w-[240px]" />
      </div>

      <QueryView query={ratings}>
        {(r) => (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <Matchup r={r} a={focus} b={rival} colorA={colorA} colorB={colorB} dashedB={sameTeam} />
              <LapDuel colorA={colorA} colorB={colorB} />
            </div>
            <Leaderboard r={r} />
          </div>
        )}
      </QueryView>
    </>
  );
}

function Matchup({ r, a, b, colorA, colorB, dashedB }: { r: RatingsResponse; a: DriverInfo | null; b: DriverInfo | null; colorA: string; colorB: string; dashedB: boolean }) {
  const ra = r.drivers.find((d) => d.code === a?.code);
  const rb = r.drivers.find((d) => d.code === b?.code);
  const metrics = r.metrics.filter((m) => m.weight > 0);
  if (!a || !ra) return <Empty>Select a driver.</Empty>;
  return (
    <Panel accent title="Ratings" subtitle="Scored 60–99 against everyone in this session; weights depend on the session type">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,300px)_1fr]">
        <Side d={a} rating={ra.overall} rank={ra.rank} color={colorA} />
        <RatingRadar
          axes={metrics.map((m) => ({ key: m.key, label: m.label }))}
          a={{ label: a.code, color: colorA, scores: ra.scores }}
          b={rb && b ? { label: b.code, color: colorB, scores: rb.scores, dashed: dashedB } : undefined}
        />
        {b && rb ? <Side d={b} rating={rb.overall} rank={rb.rank} color={colorB} align="right" /> : <div className="text-sm text-ink-3">Pick a rival to compare.</div>}
      </div>
      <div className="mt-4 space-y-2.5 border-t border-line pt-4">
        {metrics.map((m) => {
          const va = ra.scores[m.key];
          const vb = rb?.scores[m.key];
          return (
            <div key={m.key} className="grid grid-cols-[1fr_8.5rem_1fr] items-center gap-3 text-[13px]">
              <div className="flex items-center justify-end gap-2">
                <span className="tnum text-xs text-ink-3">{rawFormat(m.key, ra.raw[m.key])}</span>
                <span className="h-2 w-28 overflow-hidden rounded-full bg-surface-3 [direction:rtl]">
                  <span className="block h-full rounded-full" style={{ width: `${(((va ?? 60) - 55) / 44) * 100}%`, background: colorA }} />
                </span>
                <span className={cn("tnum w-8 text-right", va != null && vb != null && va > vb && "font-bold")}>{va?.toFixed(0) ?? "—"}</span>
              </div>
              <div className="text-center text-ink-2">{m.label}</div>
              <div className="flex items-center gap-2">
                <span className={cn("tnum w-8", va != null && vb != null && vb > va && "font-bold")}>{vb?.toFixed(0) ?? "—"}</span>
                <span className="h-2 w-28 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full" style={{ width: `${(((vb ?? 60) - 55) / 44) * 100}%`, background: colorB }} />
                </span>
                <span className="tnum text-xs text-ink-3">{rb ? rawFormat(m.key, rb.raw[m.key]) : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Side({ d, rating, rank, color, align = "left" }: { d: DriverInfo; rating: number | null; rank: number; color: string; align?: "left" | "right" }) {
  return (
    <div className={cn("flex items-center gap-3", align === "right" && "flex-row-reverse text-right")}>
      <DriverAvatar code={d.code} number={d.number} team={d.team} size="lg" />
      <div>
        <div className="text-lg font-bold italic">{d.last_name || d.code}</div>
        <div className="text-xs text-ink-3">{d.team}</div>
        <div className="tnum mt-2 text-4xl font-semibold" style={{ color }}>
          {rating?.toFixed(0) ?? "—"}
        </div>
        <div className="text-xs text-ink-3">#{rank} in session</div>
      </div>
    </div>
  );
}

function LapDuel({ colorA, colorB }: { colorA: string; colorB: string }) {
  const { key, driver, vs } = useSelection();
  const { prefs } = usePreferences();
  const cmp = useCompare(key, driver, "fastest", vs, "fastest");
  if (!vs) return null;
  return (
    <Panel title="Best lap against best lap">
      <QueryView query={cmp}>
        {(c) => {
          const rows: { label: string; a: string; b: string; better: "a" | "b" | null }[] = [
            { label: "Lap time", a: lapTime(c.a.lap.time), b: lapTime(c.b.lap.time), better: cmpLow(c.a.lap.time, c.b.lap.time) },
            ...c.sectors.map((s) => ({ label: `Sector ${s.sector.slice(1)}`, a: sectorTime(s.a), b: sectorTime(s.b), better: cmpLow(s.a, s.b) })),
            ...statRows(c.a.stats, c.b.stats, prefs.speedUnit),
            { label: "Mini-sectors won", a: String(c.dominance.a), b: String(c.dominance.b), better: c.dominance.a === c.dominance.b ? null : c.dominance.a > c.dominance.b ? "a" : "b" },
          ];
          return (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3">
                  <th className="py-1.5 text-left font-medium" />
                  <th className="py-1.5 text-right font-semibold" style={{ color: colorA }}>
                    {c.a.driver.code} <span className="font-normal text-ink-3">L{c.a.lap.lap}</span>
                  </th>
                  <th className="py-1.5 text-right font-semibold" style={{ color: colorB }}>
                    {c.b.driver.code} <span className="font-normal text-ink-3">L{c.b.lap.lap}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-line/50 last:border-0">
                    <td className="py-1.5 text-ink-2">{row.label}</td>
                    <td className={cn("tnum py-1.5 text-right", row.better === "a" ? "font-bold text-ink" : "text-ink-2")}>{row.a}</td>
                    <td className={cn("tnum py-1.5 text-right", row.better === "b" ? "font-bold text-ink" : "text-ink-2")}>{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      </QueryView>
    </Panel>
  );
}

function cmpLow(a: number | null, b: number | null): "a" | "b" | null {
  if (a == null || b == null || a === b) return null;
  return a < b ? "a" : "b";
}
function cmpHigh(a: number | null, b: number | null): "a" | "b" | null {
  if (a == null || b == null || a === b) return null;
  return a > b ? "a" : "b";
}

function statRows(a: TelemetryStats, b: TelemetryStats, unit: "kmh" | "mph") {
  const u = speedUnitLabel(unit);
  return [
    { label: `Top speed (${u})`, a: speed(a.max_speed, unit), b: speed(b.max_speed, unit), better: cmpHigh(a.max_speed, b.max_speed) },
    { label: `Slowest point (${u})`, a: speed(a.min_speed, unit), b: speed(b.min_speed, unit), better: cmpHigh(a.min_speed, b.min_speed) },
    { label: "Full throttle", a: `${a.full_throttle_pct?.toFixed(1)}%`, b: `${b.full_throttle_pct?.toFixed(1)}%`, better: cmpHigh(a.full_throttle_pct, b.full_throttle_pct) },
    { label: "On the brakes", a: `${a.braking_pct?.toFixed(1)}%`, b: `${b.braking_pct?.toFixed(1)}%`, better: null },
    { label: "Gear changes", a: String(a.gear_changes), b: String(b.gear_changes), better: null },
  ];
}

function Leaderboard({ r }: { r: RatingsResponse }) {
  const { driver, vs, set } = useSelection();
  return (
    <Panel title="Session ratings" subtitle="Click a driver to focus, Alt-click to set as rival" flush bodyClassName="px-2 pb-2">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="py-1.5 pl-2 font-medium">#</th>
            <th className="py-1.5 font-medium">Driver</th>
            <th className="py-1.5 pr-2 text-right font-medium">Overall</th>
          </tr>
        </thead>
        <tbody>
          {r.drivers.map((d) => (
            <tr
              key={d.code}
              onClick={(e) => (e.altKey ? set({ vs: d.code }) : set({ driver: d.code }))}
              className={cn("cursor-pointer border-b border-line/50 last:border-0 hover:bg-surface-2", d.code === driver && "bg-surface-3", d.code === vs && "bg-surface-2")}
            >
              <td className="tnum py-1.5 pl-2 text-ink-3">{d.rank}</td>
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <TeamStripe team={d.team} color={d.team_color} />
                  <span className="font-semibold">{d.code}</span>
                  <span className="truncate text-xs text-ink-3">{d.team}</span>
                </span>
              </td>
              <td className="py-1.5 pr-2">
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full" style={{ width: `${(((d.overall ?? 60) - 55) / 44) * 100}%`, background: teamColor(d.team, d.team_color) }} />
                  </span>
                  <span className="tnum w-8 text-right font-semibold">{d.overall?.toFixed(0) ?? "—"}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
