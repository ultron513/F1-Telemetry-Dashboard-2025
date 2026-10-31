"use client";

import { useState } from "react";

import type { PitStop, StrategyResponse } from "@/lib/api/types";
import { compound } from "@/lib/f1";
import { TRACK_STATUS } from "@/lib/f1";
import { lapTime } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";

import { AXIS_TEXT, ChartTooltip, linear, ticks, useSize } from "./core";

interface Props {
  data: StrategyResponse;
  lapStatus?: { lap: number; status: string }[];
  focus?: string | null;
  onSelect?: (code: string) => void;
}

const ROW = 26;
const LEFT = 64;
const RIGHT = 12;
const TOP = 22;

/** Tyre strategy for the whole field: one row per driver, stints coloured by compound. */
export function StrategyGantt({ data, lapStatus = [], focus, onSelect }: Props) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; body: React.ReactNode } | null>(null);
  const total = data.total_laps ?? Math.max(...data.stints.flatMap((d) => d.stints.map((s) => s.end_lap ?? 0)), 1);
  const innerW = Math.max(10, width - LEFT - RIGHT);
  const sx = linear([0, total], [LEFT, LEFT + innerW]);
  const height = TOP + data.stints.length * ROW + 8;
  const stopsBy = new Map<string, PitStop[]>();
  data.pit_stops.forEach((p) => stopsBy.set(p.code, [...(stopsBy.get(p.code) ?? []), p]));

  // Merge consecutive non-green laps into bands.
  const bands: { from: number; to: number; status: string }[] = [];
  for (const l of lapStatus) {
    if (l.status === "1" || l.status === "2") continue;
    const last = bands[bands.length - 1];
    if (last && last.status === l.status && last.to === l.lap - 1) last.to = l.lap;
    else bands.push({ from: l.lap, to: l.lap, status: l.status });
  }

  return (
    <div ref={ref} className="relative w-full" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Tyre strategy for every driver by lap">
          {bands.map((b, i) => (
            <g key={i}>
              <rect x={sx(b.from - 1)} y={TOP - 4} width={sx(b.to) - sx(b.from - 1)} height={height - TOP} fill={TRACK_STATUS[b.status]?.color ?? "#888"} opacity={0.14} />
              <text x={sx(b.from - 1) + 3} y={TOP - 8} {...AXIS_TEXT} fontSize={10} fill={TRACK_STATUS[b.status]?.color}>
                {b.status === "4" ? "SC" : b.status === "5" ? "RED" : "VSC"}
              </text>
            </g>
          ))}
          {ticks(0, total, Math.max(4, Math.floor(innerW / 70))).map((t) => (
            <g key={t} aria-hidden>
              <line x1={sx(t)} x2={sx(t)} y1={TOP - 2} y2={height - 6} stroke="var(--chart-grid)" />
              <text x={sx(t)} y={11} textAnchor="middle" {...AXIS_TEXT}>
                {t === 0 ? "Lap" : t}
              </text>
            </g>
          ))}
          {data.stints.map((d, row) => {
            const y = TOP + row * ROW;
            const isFocus = focus === d.code;
            return (
              <g key={d.code} className={cn(onSelect && "cursor-pointer")} onClick={() => onSelect?.(d.code)} opacity={focus && !isFocus ? 0.88 : 1}>
                {isFocus && <rect x={0} y={y} width={width} height={ROW} fill="var(--team-primary)" opacity={0.1} />}
                <rect x={4} y={y + 6} width={3} height={ROW - 12} rx={1.5} fill={teamColor(d.team, d.team_color)} />
                <text x={12} y={y + ROW / 2} dy="0.34em" fontSize={12.5} fontWeight={isFocus ? 700 : 600} fill="var(--ink)" fontFamily="var(--font-sans)">
                  {d.code}
                </text>
                {d.stints.map((s) => {
                  const c = compound(s.compound);
                  const x0 = sx((s.start_lap ?? 1) - 1);
                  const x1 = sx(s.end_lap ?? total);
                  return (
                    <g
                      key={s.stint}
                      onPointerMove={(e) => {
                        const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                        setTip({
                          x: e.clientX - rect.left,
                          y: y + ROW,
                          body: (
                            <>
                              <div className="font-semibold text-ink">
                                {d.code} · stint {s.stint} · {c.label}
                              </div>
                              <div className="mt-1 text-ink-2">
                                Laps {s.start_lap}–{s.end_lap} ({s.laps}) · {s.fresh ? "new set" : `used, ${s.start_age} laps old`}
                              </div>
                              <div className="text-ink-2">
                                Avg {lapTime(s.average)} · deg{" "}
                                {s.fuel_corrected_degradation != null ? `${s.fuel_corrected_degradation > 0 ? "+" : ""}${s.fuel_corrected_degradation.toFixed(3)} s/lap` : "—"}
                              </div>
                            </>
                          ),
                        });
                      }}
                    >
                      <rect x={x0 + 1} y={y + 5} width={Math.max(2, x1 - x0 - 2)} height={ROW - 10} rx={4} fill={c.color} opacity={s.fresh ? 1 : 0.62} />
                      {!s.fresh && (
                        <rect x={x0 + 1} y={y + 5} width={Math.max(2, x1 - x0 - 2)} height={ROW - 10} rx={4} fill="url(#used)" />
                      )}
                      {x1 - x0 > 26 && (
                        <text x={x0 + 7} y={y + ROW / 2} dy="0.34em" fontSize={10.5} fontWeight={700} fill={c.ink} fontFamily="var(--font-sans)" pointerEvents="none">
                          {c.short}
                          <tspan fontWeight={500} dx={4}>
                            {s.laps}
                          </tspan>
                        </text>
                      )}
                    </g>
                  );
                })}
                {(stopsBy.get(d.code) ?? []).map((p) => (
                  <g key={p.stop} pointerEvents="none">
                    <line x1={sx(p.lap ?? 0)} x2={sx(p.lap ?? 0)} y1={y + 2} y2={y + ROW - 2} stroke="var(--bg)" strokeWidth={2} />
                  </g>
                ))}
              </g>
            );
          })}
          <defs>
            <pattern id="used" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.28)" strokeWidth="2" />
            </pattern>
          </defs>
        </svg>
      )}
      {tip && (
        <ChartTooltip x={tip.x} y={tip.y} width={width}>
          {tip.body}
        </ChartTooltip>
      )}
    </div>
  );
}
