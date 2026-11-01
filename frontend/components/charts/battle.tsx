"use client";

import { useMemo } from "react";

import { LineChart, type Band, type LineSeries } from "@/components/charts/line-chart";
import { Stat } from "@/components/ui/primitives";
import type { RaceTraceResponse, StrategyResponse } from "@/lib/api/types";
import { TRACK_STATUS } from "@/lib/f1";

const DRS_GAP = 1.0;

/**
 * The gap between two cars at the line, lap by lap. Above zero the first
 * driver is ahead. Shaded bands show laps in DRS range (within a second),
 * markers show each car's pit stops and neutralised laps are tinted.
 */
export function BattleView({
  trace,
  strategy,
  a,
  b,
  colorA,
  colorB,
}: {
  trace: RaceTraceResponse;
  strategy: StrategyResponse | undefined;
  a: string;
  b: string;
  colorA: string;
  colorB: string;
}) {
  const { points, drsLaps, swaps, closest } = useMemo(() => {
    const ta = new Map(trace.drivers.find((d) => d.code === a)?.points.map((p) => [p.lap, p.gap]) ?? []);
    const tb = new Map(trace.drivers.find((d) => d.code === b)?.points.map((p) => [p.lap, p.gap]) ?? []);
    const pts: { x: number; y: number | null }[] = [];
    let drs = 0;
    let swaps = 0;
    let closest: number | null = null;
    let prevSign = 0;
    for (const [lap, ga] of ta) {
      const gb = tb.get(lap);
      if (ga == null || gb == null) continue;
      const gap = gb - ga; // positive: a ahead
      pts.push({ x: lap, y: Math.round(gap * 1000) / 1000 });
      if (Math.abs(gap) <= DRS_GAP) drs += 1;
      const sign = Math.sign(gap);
      if (prevSign && sign && sign !== prevSign) swaps += 1;
      if (sign) prevSign = sign;
      if (closest == null || Math.abs(gap) < Math.abs(closest)) closest = gap;
    }
    return { points: pts, drsLaps: drs, swaps, closest };
  }, [trace, a, b]);

  const bands: Band[] = useMemo(() => {
    const out: Band[] = [];
    for (const p of points) {
      if (p.y != null && Math.abs(p.y) <= DRS_GAP) out.push({ from: p.x - 0.5, to: p.x + 0.5, color: "rgba(34,197,94,0.14)", label: "DRS range" });
    }
    for (const s of trace.lap_status) {
      if (s.status !== "1" && s.status !== "2") out.push({ from: s.lap - 0.5, to: s.lap + 0.5, color: `${TRACK_STATUS[s.status]?.color ?? "#f59e0b"}22`, label: TRACK_STATUS[s.status]?.label });
    }
    return out;
  }, [points, trace.lap_status]);

  const pits = (strategy?.pit_stops ?? [])
    .filter((p) => p.code === a || p.code === b)
    .map((p) => ({ x: p.lap ?? 0, label: p.code, color: p.code === a ? colorA : colorB }));

  const series: LineSeries[] = [{ id: "gap", label: `${a} vs ${b}`, color: colorA, points, width: 2.2 }];
  const last = points[points.length - 1]?.y ?? null;

  if (points.length < 2) return <p className="text-sm text-ink-3">These two never ran together long enough to compare.</p>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="At the flag" value={last == null ? "—" : `${Math.abs(last).toFixed(1)} s`} sub={last == null ? "" : last > 0 ? `${a} ahead` : `${b} ahead`} />
        <Stat label="Laps in DRS range" value={drsLaps} sub="Within one second" />
        <Stat label="Position swaps" value={swaps} sub="On track or in the pits" />
        <Stat label="Closest" value={closest == null ? "—" : `${Math.abs(closest).toFixed(2)} s`} />
      </div>
      <LineChart
        ariaLabel={`Gap between ${a} and ${b} by lap`}
        series={series}
        height={260}
        bands={bands}
        vMarkers={pits}
        refLines={[{ y: 0, label: "Level" }]}
        yFormat={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}s`}
        tooltipX={(v) => `Lap ${v}`}
        xLabel="Lap"
      />
      <p className="text-[12px] text-ink-3">
        Above the line, <span style={{ color: colorA }}>{a}</span> is ahead; below, <span style={{ color: colorB }}>{b}</span> is. Green bands: in DRS range.
      </p>
    </div>
  );
}
