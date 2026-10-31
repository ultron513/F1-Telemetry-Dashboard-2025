"use client";

import { forwardRef, useMemo, useState } from "react";

import { AXIS_TEXT, ChartTooltip, GridLines, extent, linear, pad, ticks, useSize } from "./core";

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  kind?: "line" | "dots" | "step";
  points: { x: number; y: number | null; color?: string; meta?: string }[];
  width?: number;
}

export interface Band {
  from: number;
  to: number;
  color: string;
  label?: string;
}

interface Props {
  series: LineSeries[];
  height?: number;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  tooltipX?: (v: number) => string;
  invertY?: boolean;
  yDomain?: [number, number];
  xDomain?: [number, number];
  yTicks?: number[];
  bands?: Band[];
  refLines?: { y: number; label: string; color?: string }[];
  vMarkers?: { x: number; label: string; color?: string }[];
  highlight?: Set<string> | null;
  endLabels?: boolean;
  ariaLabel: string;
  xLabel?: string;
  onHoverX?: (x: number | null) => void;
}

const M = { top: 14, right: 16, bottom: 28, left: 52 };

/** Multi-series line / dot chart with crosshair tooltip. */
export const LineChart = forwardRef<SVGSVGElement, Props>(function LineChart(
  {
    series,
    height = 300,
    xFormat = (v) => String(Math.round(v)),
    yFormat = (v) => String(Math.round(v)),
    tooltipX,
    invertY,
    yDomain,
    xDomain,
    yTicks,
    bands = [],
    refLines = [],
    vMarkers = [],
    highlight,
    endLabels,
    ariaLabel,
    xLabel,
    onHoverX,
  },
  ref,
) {
  const [wrapRef, { width }] = useSize<HTMLDivElement>();
  const [hx, setHx] = useState<number | null>(null);
  const right = endLabels ? 52 : M.right;

  const { xd, yd } = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    return {
      xd: xDomain ?? extent(xs),
      yd: yDomain ?? pad(extent(ys), 0.08),
    };
  }, [series, xDomain, yDomain]);

  const innerW = Math.max(10, width - M.left - right);
  const sx = linear(xd, [M.left, M.left + innerW]);
  const sy = linear(yd, invertY ? [M.top, height - M.bottom] : [height - M.bottom, M.top]);
  const yt = yTicks ?? ticks(yd[0], yd[1], Math.max(3, Math.floor(height / 60)));
  const xt = ticks(xd[0], xd[1], Math.max(3, Math.floor(innerW / 90))).filter((t) => Number.isInteger(t));

  // Snap the crosshair to the nearest x present in the data.
  const allX = useMemo(() => Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b), [series]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = sx.invert(e.clientX - rect.left);
    let best = allX[0];
    let bestD = Infinity;
    for (const v of allX) {
      const d = Math.abs(v - x);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    setHx(best ?? null);
    onHoverX?.(best ?? null);
  };

  const rows =
    hx == null
      ? []
      : series
          .map((s) => {
            const p = s.points.find((pt) => pt.x === hx);
            return p && p.y != null ? { s, p } : null;
          })
          .filter((r): r is NonNullable<typeof r> => !!r)
          .sort((a, b) => (invertY ? (a.p.y as number) - (b.p.y as number) : (b.p.y as number) - (a.p.y as number)))
          .slice(0, 12);

  return (
    <div ref={wrapRef} className="relative w-full">
      {width > 0 && (
        <svg
          ref={ref}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHx(null);
            onHoverX?.(null);
          }}
        >
          {bands.map((b, i) => (
            <rect
              key={i}
              x={sx(b.from)}
              y={M.top}
              width={Math.max(1, sx(b.to) - sx(b.from))}
              height={height - M.top - M.bottom}
              fill={b.color}
              opacity={0.16}
            />
          ))}
          <GridLines values={yt} scale={sy} x0={M.left} x1={M.left + innerW} format={yFormat} />
          {xt.map((t) => (
            <text key={t} x={sx(t)} y={height - 8} textAnchor="middle" {...AXIS_TEXT}>
              {xFormat(t)}
            </text>
          ))}
          {xLabel && (
            <text x={M.left + innerW} y={height - 8} textAnchor="end" {...AXIS_TEXT} dx={-2} dy={-14} opacity={0.8}>
              {xLabel}
            </text>
          )}
          {refLines.map((r) => (
            <g key={r.label}>
              <line x1={M.left} x2={M.left + innerW} y1={sy(r.y)} y2={sy(r.y)} stroke={r.color ?? "var(--ink-3)"} strokeDasharray="4 4" />
              <text x={M.left + innerW - 4} y={sy(r.y) - 5} textAnchor="end" {...AXIS_TEXT} fill={r.color ?? "var(--ink-3)"}>
                {r.label}
              </text>
            </g>
          ))}
          {vMarkers.map((m, i) => (
            <g key={i}>
              <line x1={sx(m.x)} x2={sx(m.x)} y1={M.top} y2={height - M.bottom} stroke={m.color ?? "var(--ink-3)"} strokeDasharray="2 3" />
              <text x={sx(m.x) + 3} y={M.top + 10} {...AXIS_TEXT} fontSize={10}>
                {m.label}
              </text>
            </g>
          ))}
          {series.map((s) => {
            const dim = highlight && highlight.size > 0 && !highlight.has(s.id);
            const opacity = dim ? 0.35 : 1;
            if (s.kind === "dots") {
              return (
                <g key={s.id} opacity={opacity}>
                  {s.points.map((p, i) =>
                    p.y == null ? null : (
                      <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={hx === p.x ? 5 : 3.6} fill={p.color ?? s.color} stroke="var(--surface)" strokeWidth={1.5} />
                    ),
                  )}
                </g>
              );
            }
            let d = "";
            let pen = false;
            for (const p of s.points) {
              if (p.y == null) {
                pen = false;
                continue;
              }
              const X = sx(p.x).toFixed(1);
              const Y = sy(p.y).toFixed(1);
              d += pen ? (s.kind === "step" ? `H${X}V${Y}` : `L${X},${Y}`) : `M${X},${Y}`;
              pen = true;
            }
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={opacity}
              />
            );
          })}
          {endLabels &&
            (() => {
              // Place end labels, nudging apart any that would overlap.
              const labels = series
                .map((s) => {
                  const last = [...s.points].reverse().find((p) => p.y != null);
                  return last ? { s, x: sx(last.x), y: sy(last.y as number) } : null;
                })
                .filter((l): l is NonNullable<typeof l> => !!l)
                .sort((a, b) => a.y - b.y);
              for (let i = 1; i < labels.length; i++) {
                if (labels[i].y - labels[i - 1].y < 11) labels[i].y = labels[i - 1].y + 11;
              }
              return labels.map(({ s, x, y }) => {
                const dim = highlight && highlight.size > 0 && !highlight.has(s.id);
                return (
                  <text key={s.id} x={x + 6} y={y} dy="0.32em" fontSize={10.5} fontWeight={600} fill="var(--ink-2)" opacity={dim ? 0.45 : 1} fontFamily="var(--font-sans)">
                    {s.label}
                  </text>
                );
              });
            })()}
          {hx != null && (
            <g pointerEvents="none">
              <line x1={sx(hx)} x2={sx(hx)} y1={M.top} y2={height - M.bottom} stroke="var(--ink-3)" />
              {rows.map(({ s, p }) => (
                <circle key={s.id} cx={sx(hx)} cy={sy(p.y as number)} r={4} fill={p.color ?? s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hx != null && rows.length > 0 && (
        <ChartTooltip x={sx(hx)} y={M.top} width={width}>
          <div className="mb-1 font-semibold text-ink">{tooltipX ? tooltipX(hx) : xFormat(hx)}</div>
          <div className="space-y-0.5">
            {rows.map(({ s, p }) => (
              <div key={s.id} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="size-2 rounded-full" style={{ background: p.color ?? s.color }} />
                  {s.label}
                  {p.meta && <span className="text-ink-3">{p.meta}</span>}
                </span>
                <span className="tnum text-ink">{yFormat(p.y as number)}</span>
              </div>
            ))}
          </div>
        </ChartTooltip>
      )}
    </div>
  );
});
