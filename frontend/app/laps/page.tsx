"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { LineChart, type Band, type LineSeries } from "@/components/charts/line-chart";
import { PaceBoxPlot } from "@/components/charts/misc-charts";
import { TimingCell, Tyre } from "@/components/f1/bits";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { DriverPicker } from "@/components/shell/pickers";
import { Panel } from "@/components/ui/panel";
import { Button, QueryView, Segmented, Stat } from "@/components/ui/primitives";
import { useFieldPace, useLapTable, useRaceTrace } from "@/lib/api/queries";
import type { LapRow, LapTableResponse } from "@/lib/api/types";
import { compound, TRACK_STATUS } from "@/lib/f1";
import { lapTime, speed, speedUnitLabel } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn, downloadBlob, toCsv } from "@/lib/utils";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";

export default function LapsPage() {
  return (
    <SessionGate>
      <Laps />
    </SessionGate>
  );
}

function isClean(l: LapRow) {
  return l.time != null && !l.pit_in && !l.pit_out && !l.deleted && !l.track_status.some((s) => ["4", "5", "6", "7"].includes(s));
}

function lapBands(status: { lap: number; status: string }[]): Band[] {
  const out: Band[] = [];
  for (const l of status) {
    if (!["4", "5", "6", "7"].includes(l.status)) continue;
    const last = out[out.length - 1];
    const color = TRACK_STATUS[l.status]?.color ?? "#999";
    if (last && last.color === color && last.to === l.lap - 0.5) last.to = l.lap + 0.5;
    else out.push({ from: l.lap - 0.5, to: l.lap + 0.5, color, label: TRACK_STATUS[l.status]?.label });
  }
  return out;
}

function Laps() {
  const { key, driver, vs, set, focus, rival, summary } = useSelection();
  const table = useLapTable(key, driver);
  const rivalTable = useLapTable(key, vs);
  const trace = useRaceTrace(summary?.session.kind === "race" ? key : null);
  const pace = useFieldPace(key);
  const [filter, setFilter] = useState<"clean" | "all">("clean");

  const series: LineSeries[] = useMemo(() => {
    const out: LineSeries[] = [];
    const build = (t: LapTableResponse | undefined, color: string, id: string, dashed = false): LineSeries | null => {
      if (!t) return null;
      const laps = t.laps.filter((l) => l.lap != null && l.time != null && (filter === "all" || isClean(l)));
      return {
        id,
        label: t.driver.code,
        color,
        dashed,
        kind: id === "a" ? "dots" : "line",
        width: 1.5,
        points: laps.map((l) => ({
          x: l.lap as number,
          y: l.time,
          color: id === "a" ? compound(l.compound).color : undefined,
          meta: id === "a" ? `${compound(l.compound).short}${l.tyre_life ?? ""}` : undefined,
        })),
      };
    };
    const rc = rival ? (rival.team === focus?.team ? "var(--teammate)" : teamColor(rival.team, rival.team_color)) : "#888";
    const b = build(rivalTable.data, rc, "b", rival?.team === focus?.team);
    const a = build(table.data, teamColor(focus?.team, focus?.team_color), "a");
    if (b && vs) out.push(b);
    if (a) out.push(a);
    return out;
  }, [table.data, rivalTable.data, filter, focus, rival, vs]);

  const bands = lapBands(trace.data?.lap_status ?? []);
  const pits = (table.data?.laps ?? []).filter((l) => l.pit_in).map((l) => ({ x: l.lap as number, label: "Pit" }));

  const exportCsv = () => {
    if (!table.data) return;
    const l = table.data.laps;
    downloadBlob(
      toCsv({
        lap: l.map((r) => r.lap),
        time_s: l.map((r) => r.time),
        s1: l.map((r) => r.s1),
        s2: l.map((r) => r.s2),
        s3: l.map((r) => r.s3),
        compound: l.map((r) => r.compound),
        tyre_life: l.map((r) => r.tyre_life),
        position: l.map((r) => r.position),
        speed_trap: l.map((r) => r.speed_st),
        pit_in: l.map((r) => (r.pit_in ? 1 : 0)),
        deleted: l.map((r) => (r.deleted ? 1 : 0)),
      }),
      `laps_${table.data.driver.code}.csv`,
      "text/csv",
    );
  };

  return (
    <>
      <PageHeader
        title="Lap analysis"
        description="The timing screen for one driver, how their pace moved through each stint, and where it sits against the field."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!table.data}>
            <Download className="size-4" /> CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DriverPicker caption="Driver" value={driver} onChange={(c) => c && set({ driver: c })} className="w-[240px]" />
        <DriverPicker caption="Compare with" value={vs} exclude={driver} allowNone onChange={(c) => set({ vs: c })} className="w-[240px]" />
      </div>

      <QueryView query={table}>
        {(t) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Best lap" value={<span className="text-purple">{lapTime(t.stats.best_lap)}</span>} emphasis />
              <Stat label="Ideal lap" value={lapTime(t.stats.theoretical_best)} sub="Sum of best sectors" emphasis />
              <Stat label="Clean-lap median" value={lapTime(t.stats.median_clean)} />
              <Stat label="Clean-lap average" value={lapTime(t.stats.average_clean)} />
              <Stat label="Consistency (σ)" value={t.stats.std_clean != null ? `${t.stats.std_clean.toFixed(3)}s` : "—"} />
              <Stat label="Laps" value={`${t.stats.clean_laps}/${t.stats.total_laps}`} sub="clean / total" />
            </div>

            <Panel
              accent
              title="Lap times"
              subtitle={`Dots are ${t.driver.code}'s laps coloured by tyre${vs ? `; the line is ${vs}` : ""}. Shaded laps ran under Safety Car or VSC.`}
              actions={
                <Segmented
                  size="sm"
                  label="Laps shown"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "clean", label: "Clean laps" },
                    { value: "all", label: "All laps" },
                  ]}
                />
              }
            >
              <LineChart
                series={series}
                height={320}
                yFormat={(v) => lapTime(v, 1)}
                tooltipX={(v) => `Lap ${v}`}
                bands={bands}
                vMarkers={pits}
                xLabel="lap"
                ariaLabel={`Lap times for ${t.driver.code}`}
              />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                {Array.from(new Set(t.laps.map((l) => l.compound).filter(Boolean))).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: compound(c).color }} />
                    {compound(c).label}
                  </span>
                ))}
              </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <TimingTable t={t} />
              <Panel title="Stints">
                <ul className="space-y-3">
                  {t.stints.map((s) => (
                    <li key={s.stint} className="flex items-center gap-3 rounded-md border border-line p-3">
                      <Tyre compound={s.compound} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold">
                          Stint {s.stint} · {compound(s.compound).label}
                        </div>
                        <div className="tnum text-xs text-ink-3">
                          Laps {s.start_lap}–{s.end_lap} ({s.laps})
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tnum text-[13.5px]">{lapTime(s.average)}</div>
                        <div className="tnum text-xs text-ink-3">best {lapTime(s.best)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}
      </QueryView>

      <Panel share title="Field pace" subtitle="Clean green-flag laps for every driver. Boxes hold the middle half of their laps; the bar inside is the median." className="mt-4">
        <QueryView query={pace}>{(p) => <PaceBoxPlot drivers={p.drivers} focus={driver} />}</QueryView>
      </Panel>
    </>
  );
}

function TimingTable({ t }: { t: LapTableResponse }) {
  const { prefs } = usePreferences();
  return (
    <Panel title="Timing" subtitle="Purple is the session best, green a personal best" flush bodyClassName="px-2 pb-2">
      <div className="scroll-thin max-h-[560px] overflow-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="py-2 pl-2 font-medium">Lap</th>
              <th className="py-2 text-right font-medium">Time</th>
              <th className="py-2 text-right font-medium">S1</th>
              <th className="py-2 text-right font-medium">S2</th>
              <th className="py-2 text-right font-medium">S3</th>
              <th className="py-2 pl-4 font-medium">Tyre</th>
              <th className="py-2 text-right font-medium">Pos</th>
              <th className="py-2 text-right font-medium">Trap {speedUnitLabel(prefs.speedUnit)}</th>
              <th className="py-2 pr-2 pl-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {t.laps.map((l) => {
              const neutral = l.track_status.find((s) => ["4", "5", "6", "7"].includes(s));
              return (
                <tr key={l.lap} className={cn("border-b border-line/50 last:border-0", l.pit_in || l.pit_out ? "bg-surface-2" : "")}>
                  <td className="tnum py-1.5 pl-2 text-ink-3">{l.lap}</td>
                  <td className="py-1.5 text-right">
                    <TimingCell value={l.time} grade={l.grade} kind="lap" deleted={l.deleted} />
                  </td>
                  <td className="py-1.5 text-right"><TimingCell value={l.s1} grade={l.s1_grade} /></td>
                  <td className="py-1.5 text-right"><TimingCell value={l.s2} grade={l.s2_grade} /></td>
                  <td className="py-1.5 text-right"><TimingCell value={l.s3} grade={l.s3_grade} /></td>
                  <td className="py-1.5 pl-4"><Tyre compound={l.compound} age={l.tyre_life} size={16} /></td>
                  <td className="tnum py-1.5 text-right text-ink-2">{l.position ?? "—"}</td>
                  <td className="tnum py-1.5 text-right text-ink-2">{speed(l.speed_st, prefs.speedUnit)}</td>
                  <td className="py-1.5 pr-2 pl-3 text-xs text-ink-3">
                    {[
                      l.pit_in && "In lap",
                      l.pit_out && "Out lap",
                      l.deleted && (l.deleted_reason ? `Deleted: ${l.deleted_reason.toLowerCase()}` : "Deleted"),
                      neutral && TRACK_STATUS[neutral]?.label,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
