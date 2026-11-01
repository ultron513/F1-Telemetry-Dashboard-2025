"use client";

// The evidence next to an answer: each chart the analyst cites is rendered
// with the same components (and cached queries) as the dashboard pages.

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { BattleView } from "@/components/charts/battle";
import { PaceBoxPlot } from "@/components/charts/misc-charts";
import { StrategyGantt } from "@/components/charts/strategy-gantt";
import { TraceStack, type TraceChannel } from "@/components/charts/trace-stack";
import { UndercutView } from "@/components/charts/undercut";
import { Classification } from "@/components/session/classification";
import { Panel } from "@/components/ui/panel";
import { QueryView } from "@/components/ui/primitives";
import {
  useCompare,
  useFieldPace,
  useRaceControl,
  useRaceTrace,
  useStrategy,
  useUndercut,
} from "@/lib/api/queries";
import type { AnswerChart, Channels, DriverInfo } from "@/lib/api/types";
import { speedUnitLabel } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";

function useDriverColor() {
  const { drivers } = useSelection();
  const byCode = new Map<string, DriverInfo>(drivers.map((d) => [d.code, d]));
  return (code: string) => {
    const d = byCode.get(code);
    return d ? teamColor(d.team, d.team_color) : "var(--ink-3)";
  };
}

function sameTeam(drivers: DriverInfo[], a: string, b: string) {
  const ta = drivers.find((d) => d.code === a)?.team;
  return !!ta && ta === drivers.find((d) => d.code === b)?.team;
}

/** Deep link into the full dashboard page, keeping the session and setting the drivers. */
function useHref() {
  const { season, round, session } = useSelection();
  return (path: string, extra: Record<string, string> = {}) => {
    const qs = new URLSearchParams({
      ...(season ? { season: String(season) } : {}),
      ...(round ? { round: String(round) } : {}),
      ...(session ? { session } : {}),
      ...extra,
    });
    return `${path}?${qs}`;
  };
}

const TITLES: Record<AnswerChart["type"], string> = {
  results: "Classification",
  "race-trace": "The gap, lap by lap",
  compare: "Fastest laps compared",
  strategy: "Tyre strategy",
  "race-control": "Race control",
  pace: "Race pace",
  degradation: "Tyre degradation",
  undercut: "Undercut simulation",
  weather: "Weather",
  standings: "Championship",
};

function chartLink(c: AnswerChart): [string, Record<string, string>] {
  switch (c.type) {
    case "results":
      return ["/", {}];
    case "race-trace":
      return ["/performance", { driver: c.drivers[0], vs: c.drivers[1] }];
    case "compare":
      return ["/telemetry", { driver: c.a, vs: c.b }];
    case "strategy":
      return ["/strategy", c.drivers?.[0] ? { driver: c.drivers[0] } : {}];
    case "race-control":
      return ["/race-control", {}];
    case "pace":
      return ["/laps", {}];
    case "degradation":
      return ["/strategy", { driver: c.driver }];
    case "undercut":
      return ["/simulator", { driver: c.attacker, vs: c.defender }];
    case "weather":
      return ["/weather", {}];
    case "standings":
      return ["/standings", {}];
  }
}

export function AnswerChartCard({ chart }: { chart: AnswerChart }) {
  const href = useHref();
  const [path, extra] = chartLink(chart);
  const inline = INLINE.has(chart.type);
  return (
    <Panel
      title={
        chart.type === "race-trace"
          ? `${TITLES[chart.type]} · ${chart.drivers.join(" vs ")}`
          : chart.type === "compare"
            ? `${TITLES[chart.type]} · ${chart.a} vs ${chart.b}`
            : TITLES[chart.type]
      }
      actions={
        <Link
          href={href(path, extra)}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-3 hover:text-team"
        >
          Open full view <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      }
      bodyClassName={inline ? undefined : "py-3"}
    >
      {inline ? (
        <ChartBody chart={chart} />
      ) : (
        <p className="text-[13px] text-ink-3">The full breakdown is on its dashboard page.</p>
      )}
    </Panel>
  );
}

const INLINE = new Set<AnswerChart["type"]>(["results", "race-trace", "compare", "strategy", "race-control", "pace", "undercut"]);

function ChartBody({ chart }: { chart: AnswerChart }) {
  switch (chart.type) {
    case "results":
      return <ResultsChart />;
    case "race-trace":
      return <GapChart a={chart.drivers[0]} b={chart.drivers[1]} />;
    case "compare":
      return <CompareChart a={chart.a} b={chart.b} />;
    case "strategy":
      return <StrategyChart focus={chart.drivers?.[0] ?? null} />;
    case "race-control":
      return <RaceControlChart />;
    case "pace":
      return <PaceChart />;
    case "undercut":
      return <UndercutChart attacker={chart.attacker} defender={chart.defender} lap={chart.lap} />;
    default:
      return null;
  }
}

function ResultsChart() {
  const { summary } = useSelection();
  return summary ? <Classification summary={summary} limit={10} /> : null;
}

function GapChart({ a, b }: { a: string; b: string }) {
  const { key, drivers } = useSelection();
  const trace = useRaceTrace(key);
  const strategy = useStrategy(key);
  const color = useDriverColor();
  return (
    <QueryView query={trace}>
      {(t) => (
        <BattleView
          trace={t}
          strategy={strategy.data}
          a={a}
          b={b}
          colorA={color(a)}
          colorB={sameTeam(drivers, a, b) ? "var(--teammate)" : color(b)}
        />
      )}
    </QueryView>
  );
}

function values(ch: Channels, k: number) {
  return { speed: ch.speed.map((v) => v * k), throttle: ch.throttle, brake: ch.brake };
}

function CompareChart({ a, b }: { a: string; b: string }) {
  const { key, drivers } = useSelection();
  const { prefs } = usePreferences();
  const cmp = useCompare(key, a, "fastest", b, "fastest");
  const color = useDriverColor();
  const k = prefs.speedUnit === "mph" ? 0.621371 : 1;
  const channels: TraceChannel[] = [
    { key: "speed", label: "Speed", unit: speedUnitLabel(prefs.speedUnit), height: 150 },
    { key: "throttle", label: "Throttle", unit: "%", height: 70, domain: [-5, 105], tickValues: [0, 50, 100] },
    { key: "brake", label: "Brake", height: 40, step: true, domain: [-0.15, 1.15], tickValues: [0, 1], format: (v) => (v >= 0.5 ? "On" : "Off") },
  ];
  return (
    <QueryView query={cmp}>
      {(d) => (
        <TraceStack
          series={[
            { id: "a", label: a, color: color(a), distance: d.distance, values: values(d.channels_a, k) },
            { id: "b", label: b, color: color(b), dashed: sameTeam(drivers, a, b), distance: d.distance, values: values(d.channels_b, k) },
          ]}
          channels={channels}
          sectorMarks={d.sector_marks}
          delta={{ distance: d.distance, values: d.delta, aColor: color(a), bColor: color(b), aLabel: a, bLabel: b }}
        />
      )}
    </QueryView>
  );
}

function StrategyChart({ focus }: { focus: string | null }) {
  const { key } = useSelection();
  const strategy = useStrategy(key);
  const trace = useRaceTrace(key);
  return (
    <QueryView query={strategy}>
      {(s) => <StrategyGantt data={s} lapStatus={trace.data?.lap_status} focus={focus} />}
    </QueryView>
  );
}

function PaceChart() {
  const { key, driver } = useSelection();
  const pace = useFieldPace(key);
  return <QueryView query={pace}>{(p) => <PaceBoxPlot drivers={p.drivers.slice(0, 12)} focus={driver} height={280} />}</QueryView>;
}

const RC_TONE: Record<string, string> = { sc: "text-warn", vsc: "text-warn", red: "text-bad", penalty: "text-bad", black_white: "text-bad", investigation: "text-ink-2" };

function RaceControlChart() {
  const { key } = useSelection();
  const rc = useRaceControl(key);
  return (
    <QueryView query={rc}>
      {(d) => {
        const key_ = d.messages.filter((m) => ["sc", "vsc", "red", "penalty", "black_white", "investigation"].includes(m.kind)).slice(0, 12);
        return key_.length ? (
          <ol className="divide-y divide-line">
            {key_.map((m) => (
              <li key={m.id} className="flex gap-3 py-2 text-[13px]">
                <span className="tnum w-9 shrink-0 text-right text-ink-3">{m.lap != null ? `L${m.lap}` : "—"}</span>
                <span className={`w-28 shrink-0 font-semibold ${RC_TONE[m.kind] ?? "text-ink-2"}`}>{m.title}</span>
                <span className="min-w-0 text-ink-2">{m.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-ink-3">A clean session: no safety cars, red flags, penalties or investigations.</p>
        );
      }}
    </QueryView>
  );
}

function UndercutChart({ attacker, defender, lap }: { attacker: string; defender: string; lap: number }) {
  const { key } = useSelection();
  const q = useUndercut(key, attacker, defender, lap);
  return <QueryView query={q}>{(u) => <UndercutView u={u} />}</QueryView>;
}
