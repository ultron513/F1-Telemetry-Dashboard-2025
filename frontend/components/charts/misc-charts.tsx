"use client";

import { useState } from "react";

import type { DriverPace } from "@/lib/api/types";
import { lapTime } from "@/lib/format";
import { teamColor } from "@/lib/teams";

import { ChartTooltip, GridLines, extent, linear, pad, ticks, useSize } from "./core";

/** Field pace: box (IQR) + whisker (min–max) + median tick per driver, ordered by median. */
export function PaceBoxPlot({ drivers, focus, height = 320 }: { drivers: DriverPace[]; focus?: string | null; height?: number }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const M = { top: 12, right: 12, bottom: 30, left: 60 };
  const innerW = Math.max(10, width - M.left - M.right);
  const values = drivers.flatMap((d) => [d.q1, d.q3, d.min, d.max].filter((v): v is number => v != null));
  // Clip whiskers at a sensible window so one outlier doesn't flatten everything.
  const [lo, hi] = extent(values);
  const med = drivers[0]?.median ?? lo;
  const yd = pad([Math.max(lo, med - 1.5), Math.min(hi, med + 4)], 0.04);
  // Faster laps sit higher, as on a timing screen.
  const sy = linear(yd, [M.top, height - M.bottom]);
  const band = innerW / Math.max(1, drivers.length);
  const bw = Math.min(22, band * 0.56);

  return (
    <div ref={ref} className="relative w-full" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Race pace distribution by driver">
          <GridLines values={ticks(yd[0], yd[1], 5)} scale={sy} x0={M.left} x1={M.left + innerW} format={(v) => lapTime(v, 1)} />
          {drivers.map((d, i) => {
            const cx = M.left + band * i + band / 2;
            const color = teamColor(d.team, d.team_color);
            const isFocus = focus === d.code;
            const clampY = (v: number | null) => sy(Math.min(yd[1], Math.max(yd[0], v ?? yd[0])));
            return (
              <g key={d.code} onPointerEnter={() => setHover(i)} opacity={focus && !isFocus && hover == null ? 0.75 : 1}>
                <rect x={cx - band / 2} y={M.top} width={band} height={height - M.top - M.bottom} fill="transparent" />
                <line x1={cx} x2={cx} y1={clampY(d.min)} y2={clampY(d.max)} stroke={color} strokeWidth={1.5} />
                <rect
                  x={cx - bw / 2}
                  y={clampY(d.q1)}
                  width={bw}
                  height={Math.max(2, clampY(d.q3) - clampY(d.q1))}
                  rx={3}
                  fill={color}
                  opacity={0.85}
                  stroke={isFocus ? "var(--ink)" : "none"}
                  strokeWidth={1.5}
                />
                <line x1={cx - bw / 2} x2={cx + bw / 2} y1={clampY(d.median)} y2={clampY(d.median)} stroke="var(--bg)" strokeWidth={2} />
                <text x={cx} y={height - 10} textAnchor="middle" fontSize={10.5} fontWeight={isFocus ? 700 : 500} fill={isFocus ? "var(--ink)" : "var(--ink-2)"} fontFamily="var(--font-sans)">
                  {d.code}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && drivers[hover] && (
        <ChartTooltip x={M.left + band * hover + band / 2} y={M.top} width={width}>
          <div className="font-semibold text-ink">{drivers[hover].code} · {drivers[hover].laps.length} clean laps</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 text-ink-2">
            <span>Median</span><span className="tnum text-right text-ink">{lapTime(drivers[hover].median)}</span>
            <span>Best</span><span className="tnum text-right text-ink">{lapTime(drivers[hover].min)}</span>
            <span>Middle 50%</span><span className="tnum text-right text-ink">{lapTime(drivers[hover].q1, 2)}–{lapTime(drivers[hover].q3, 2)}</span>
            <span>Gap</span><span className="tnum text-right text-ink">+{(drivers[hover].gap_to_best ?? 0).toFixed(3)}s</span>
          </div>
        </ChartTooltip>
      )}
      <span className="sr-only">{drivers.map((d) => `${d.code} median ${lapTime(d.median)}`).join(", ")}</span>
    </div>
  );
}

/** Radar for 2 drivers over shared 60–99 rating axes. */
export function RatingRadar({
  axes,
  a,
  b,
  size = 300,
}: {
  axes: { key: string; label: string }[];
  a: { label: string; color: string; scores: Record<string, number | null> };
  b?: { label: string; color: string; scores: Record<string, number | null>; dashed?: boolean };
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 30;
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const r = (v: number | null) => (Math.max(55, Math.min(100, v ?? 55)) - 55) / 45 * R;
  const poly = (scores: Record<string, number | null>) =>
    axes.map((ax, i) => `${cx + Math.cos(angle(i)) * r(scores[ax.key])},${cy + Math.sin(angle(i)) * r(scores[ax.key])}`).join(" ");

  return (
    <svg viewBox={`-56 -6 ${size + 112} ${size + 12}`} className="mx-auto w-full max-w-[380px]" role="img" aria-label={`Rating comparison ${a.label}${b ? ` vs ${b.label}` : ""}`}>
      {[60, 70, 80, 90, 100].map((lvl) => (
        <polygon
          key={lvl}
          points={axes.map((_, i) => `${cx + Math.cos(angle(i)) * r(lvl)},${cy + Math.sin(angle(i)) * r(lvl)}`).join(" ")}
          fill="none"
          stroke="var(--chart-grid)"
        />
      ))}
      {axes.map((ax, i) => {
        const x = cx + Math.cos(angle(i)) * (R + 18);
        const y = cy + Math.sin(angle(i)) * (R + 18);
        return (
          <g key={ax.key}>
            <line x1={cx} y1={cy} x2={cx + Math.cos(angle(i)) * R} y2={cy + Math.sin(angle(i)) * R} stroke="var(--chart-grid)" />
            <text x={x} y={y} textAnchor={Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end"} dy="0.34em" fontSize={12.5} fill="var(--ink-2)" fontFamily="var(--font-sans)">
              {ax.label}
            </text>
          </g>
        );
      })}
      {b && <polygon points={poly(b.scores)} fill={b.color} fillOpacity={0.14} stroke={b.color} strokeWidth={2} strokeDasharray={b.dashed ? "5 3" : undefined} />}
      <polygon points={poly(a.scores)} fill={a.color} fillOpacity={0.2} stroke={a.color} strokeWidth={2} />
    </svg>
  );
}

/** Wind rose: frequency by compass sector, stacked by speed band (sequential ramp). */
export function WindRose({
  data,
  color,
  size = 280,
}: {
  data: { direction: string; share: number; bands: { from: number; to: number; share: number }[] }[];
  color: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 26;
  const max = Math.max(5, ...data.map((d) => d.share));
  const rs = (v: number) => (v / max) * R;
  const ramp = ["0.25", "0.4", "0.55", "0.7", "0.85", "1"];
  const wedge = (i: number, r0: number, r1: number) => {
    const a0 = ((i * 45 - 22.5 + 2) * Math.PI) / 180 - Math.PI / 2;
    const a1 = ((i * 45 + 22.5 - 2) * Math.PI) / 180 - Math.PI / 2;
    const p = (r: number, a: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    return `M${p(r0, a0)}L${p(r1, a0)}A${r1},${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 0 0 ${p(r0, a0)}Z`;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="Wind rose: share of samples by wind direction">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="var(--chart-grid)" />
      ))}
      {data.map((d, i) => {
        let acc = 0;
        return (
          <g key={d.direction}>
            {d.bands.map((b, j) => {
              if (!b.share) return null;
              const r0 = rs(acc);
              acc += b.share;
              return <path key={j} d={wedge(i, r0, rs(acc))} fill={color} fillOpacity={Number(ramp[j])} stroke="var(--surface)" strokeWidth={1} />;
            })}
            <text
              x={cx + Math.cos((i * 45 * Math.PI) / 180 - Math.PI / 2) * (R + 14)}
              y={cy + Math.sin((i * 45 * Math.PI) / 180 - Math.PI / 2) * (R + 14)}
              textAnchor="middle"
              dy="0.34em"
              fontSize={11}
              fontWeight={600}
              fill="var(--ink-2)"
              fontFamily="var(--font-sans)"
            >
              {d.direction}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars with labels, for rankings (points, pit times). */
export function BarList({
  rows,
  format,
  max,
  lowerIsBetter,
}: {
  rows: { id: string; label: React.ReactNode; value: number; color: string; sub?: React.ReactNode }[];
  format: (v: number) => string;
  max?: number;
  lowerIsBetter?: boolean;
}) {
  const vals = rows.map((r) => r.value);
  const hi = max ?? Math.max(...vals, 1);
  const lo = lowerIsBetter ? Math.min(...vals) * 0.92 : 0;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const frac = (r.value - lo) / (hi - lo || 1);
        return (
          <li key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 truncate">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%`, background: r.color }} />
            </span>
            <span className="tnum text-right text-ink">{format(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}
