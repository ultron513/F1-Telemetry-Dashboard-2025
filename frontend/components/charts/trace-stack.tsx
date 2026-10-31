"use client";

import { forwardRef, useId, useMemo, useRef, useState } from "react";

import { bisect, clamp } from "@/lib/utils";
import { hoverDistance, useStore } from "@/state/store";

import { AXIS_TEXT, extent, linear, linePath, pad, ticks, useSize, windowIndices } from "./core";

export interface TraceSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  distance: number[];
  values: Record<string, (number | null)[]>;
}

export interface TraceChannel {
  key: string;
  label: string;
  unit?: string;
  height: number;
  step?: boolean;
  domain?: [number, number];
  tickValues?: number[];
  format?: (v: number) => string;
}

export interface DeltaTrace {
  distance: number[];
  values: number[];
  aColor: string;
  bColor: string;
  aLabel: string;
  bLabel: string;
}

interface Props {
  series: TraceSeries[];
  channels: TraceChannel[];
  sectorMarks?: number[];
  corners?: { label: string; distance: number }[];
  delta?: DeltaTrace;
  title?: string;
}

const M = { left: 52, right: 14, top: 22, gap: 14, bottom: 26 };
const DELTA_H = 96;

/**
 * Stacked telemetry traces sharing one distance axis, one crosshair and
 * one zoom window — the core view of an engineer's telemetry screen.
 * Drag across any panel to zoom; double-click to reset.
 */
export const TraceStack = forwardRef<SVGSVGElement, Props>(function TraceStack(
  { series, channels, sectorMarks = [], corners = [], delta, title = "Telemetry traces" },
  svgRef,
) {
  const [wrapRef, { width }] = useSize<HTMLDivElement>();
  const hover = useStore(hoverDistance);
  const clipId = useId().replace(/:/g, "");
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const dragging = useRef(false);

  const xMax = useMemo(() => Math.max(1, ...series.map((s) => s.distance[s.distance.length - 1] ?? 0)), [series]);
  const domain: [number, number] = zoom ?? [0, xMax];
  const innerW = Math.max(10, width - M.left - M.right);
  const sx = linear(domain, [M.left, M.left + innerW]);

  // Vertical layout.
  const panels = useMemo(() => {
    let y = M.top;
    const out: { key: string; y: number; h: number; kind: "delta" | "channel"; ch?: TraceChannel }[] = [];
    if (delta) {
      out.push({ key: "__delta", y, h: DELTA_H, kind: "delta" });
      y += DELTA_H + M.gap;
    }
    for (const ch of channels) {
      out.push({ key: ch.key, y, h: ch.height, kind: "channel", ch });
      y += ch.height + M.gap;
    }
    return { list: out, height: y - M.gap + M.bottom };
  }, [channels, delta]);

  const xTicks = ticks(domain[0], domain[1], Math.max(3, Math.floor(innerW / 110)));

  const toDistance = (clientX: number, rect: DOMRect) => clamp(sx.invert(clientX - rect.left), domain[0], domain[1]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const d = toDistance(e.clientX, rect);
    hoverDistance.set(d);
    if (dragging.current) setDrag((g) => (g ? { ...g, x1: d } : g));
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const d = toDistance(e.clientX, rect);
    dragging.current = true;
    setDrag({ x0: d, x1: d });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onUp = () => {
    dragging.current = false;
    if (drag && Math.abs(sx(drag.x1) - sx(drag.x0)) > 10) {
      setZoom([Math.min(drag.x0, drag.x1), Math.max(drag.x0, drag.x1)]);
    }
    setDrag(null);
  };

  const hoverX = hover != null && hover >= domain[0] && hover <= domain[1] ? sx(hover) : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {zoom && (
        <button
          type="button"
          onClick={() => setZoom(null)}
          className="absolute top-0 right-3 z-10 rounded border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-2 hover:text-ink"
        >
          Reset zoom
        </button>
      )}
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={panels.height}
          role="img"
          aria-label={`${title}: ${series.map((s) => s.label).join(" vs ")}, distance ${Math.round(domain[0])}–${Math.round(domain[1])} m`}
          className="touch-pan-y"
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={() => {
            if (!dragging.current) hoverDistance.set(null);
          }}
          onDoubleClick={() => setZoom(null)}
        >
          <defs>
            <clipPath id={`${clipId}-plot`}>
              <rect x={M.left} y={0} width={innerW} height={panels.height} />
            </clipPath>
          </defs>

          {/* Corner labels along the top. */}
          <g aria-hidden>
            {corners
              .filter((c) => c.distance >= domain[0] && c.distance <= domain[1])
              .map((c) => (
                <text key={c.label + c.distance} x={sx(c.distance)} y={12} textAnchor="middle" {...AXIS_TEXT} fontSize={10}>
                  {c.label}
                </text>
              ))}
          </g>

          {panels.list.map((p) =>
            p.kind === "delta" && delta ? (
              <DeltaPanel key={p.key} y={p.y} h={p.h} sx={sx} domain={domain} delta={delta} clip={`${clipId}`} innerW={innerW} hover={hover} />
            ) : p.ch ? (
              <ChannelPanel key={p.key} y={p.y} h={p.h} ch={p.ch} sx={sx} domain={domain} series={series} clip={`${clipId}-plot`} innerW={innerW} hover={hover} />
            ) : null,
          )}

          {/* Sector boundaries. */}
          <g aria-hidden clipPath={`url(#${clipId}-plot)`}>
            {sectorMarks.map((d, i) => (
              <g key={d}>
                <line x1={sx(d)} x2={sx(d)} y1={M.top - 4} y2={panels.height - M.bottom} stroke="var(--line-strong)" strokeDasharray="2 4" />
                <text x={sx(d) + 4} y={M.top + 8} {...AXIS_TEXT} fontSize={10}>
                  S{i + 2}
                </text>
              </g>
            ))}
          </g>

          {/* X axis. */}
          <g aria-hidden>
            {xTicks.map((t) => (
              <text key={t} x={sx(t)} y={panels.height - 8} textAnchor="middle" {...AXIS_TEXT}>
                {t >= 1000 ? `${(t / 1000).toFixed(t % 1000 ? 1 : 0)}k` : t}
              </text>
            ))}
            <text x={M.left + innerW} y={panels.height - 8} textAnchor="end" {...AXIS_TEXT} dx={0} opacity={0}>
              m
            </text>
          </g>

          {drag && (
            <rect
              x={Math.min(sx(drag.x0), sx(drag.x1))}
              y={M.top}
              width={Math.abs(sx(drag.x1) - sx(drag.x0))}
              height={panels.height - M.top - M.bottom}
              fill="var(--team-primary)"
              opacity={0.12}
            />
          )}
          {hoverX != null && (
            <line x1={hoverX} x2={hoverX} y1={M.top - 6} y2={panels.height - M.bottom} stroke="var(--ink-2)" strokeWidth={1} pointerEvents="none" />
          )}
        </svg>
      )}
    </div>
  );
});

function valueAt(s: TraceSeries, key: string, d: number): number | null {
  const i = bisect(s.distance, d);
  if (i < 0) return null;
  return s.values[key]?.[i] ?? null;
}

function ChannelPanel({
  y,
  h,
  ch,
  sx,
  domain,
  series,
  clip,
  innerW,
  hover,
}: {
  y: number;
  h: number;
  ch: TraceChannel;
  sx: ReturnType<typeof linear>;
  domain: [number, number];
  series: TraceSeries[];
  clip: string;
  innerW: number;
  hover: number | null;
}) {
  const dom = useMemo<[number, number]>(() => {
    if (ch.domain) return ch.domain;
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      const [a, b] = extent(s.values[ch.key] ?? []);
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
    return pad([lo, hi], 0.08);
  }, [ch, series]);
  const sy = linear(dom, [y + h, y]);
  const tv = ch.tickValues ?? ticks(dom[0], dom[1], Math.max(2, Math.floor(h / 34)));
  const fmt = ch.format ?? ((v: number) => String(Math.round(v)));

  return (
    <g>
      <rect x={M.left} y={y} width={innerW} height={h} fill="var(--surface-2)" opacity={0.5} />
      {tv.map((t) => (
        <g key={t} aria-hidden>
          <line x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} stroke="var(--chart-grid)" />
          <text x={M.left - 6} y={sy(t)} dy="0.32em" textAnchor="end" {...AXIS_TEXT}>
            {fmt(t)}
          </text>
        </g>
      ))}
      <g clipPath={`url(#${clip})`}>
        {series.map((s) => {
          const [a, b] = windowIndices(s.distance, domain[0], domain[1]);
          return (
            <path
              key={s.id}
              d={linePath(s.distance, s.values[ch.key] ?? [], sx, sy, { step: ch.step, from: a, to: b })}
              fill="none"
              stroke={s.color}
              strokeWidth={series.length > 1 ? 1.6 : 1.8}
              strokeDasharray={s.dashed ? "5 3" : undefined}
              strokeLinejoin="round"
              opacity={series.length > 1 && s !== series[0] ? 0.9 : 1}
            />
          );
        })}
      </g>
      <text x={M.left + 8} y={y + 14} fontSize={12} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-sans)">
        {ch.label}
        {ch.unit && (
          <tspan fill="var(--ink-3)" fontWeight={400}>
            {" "}
            {ch.unit}
          </tspan>
        )}
      </text>
      {hover != null && (
        <text x={M.left + innerW - 8} y={y + 14} textAnchor="end" fontSize={12} fontFamily="var(--font-mono)">
          {series.map((s, i) => {
            const v = valueAt(s, ch.key, hover);
            return (
              <tspan key={s.id} fill={s.color} dx={i ? 12 : 0} fontWeight={600}>
                {s.label} {v == null ? "—" : fmt(v)}
              </tspan>
            );
          })}
        </text>
      )}
    </g>
  );
}

function DeltaPanel({
  y,
  h,
  sx,
  domain,
  delta,
  clip,
  innerW,
  hover,
}: {
  y: number;
  h: number;
  sx: ReturnType<typeof linear>;
  domain: [number, number];
  delta: DeltaTrace;
  clip: string;
  innerW: number;
  hover: number | null;
}) {
  const [a, b] = windowIndices(delta.distance, domain[0], domain[1]);
  const visible = delta.values.slice(a, b + 1);
  const m = Math.max(0.05, ...visible.map((v) => Math.abs(v)));
  const sy = linear([-m * 1.15, m * 1.15], [y + h, y]);
  const zero = sy(0);
  const line = linePath(delta.distance, delta.values, sx, sy, { from: a, to: b });
  const area = line
    ? `${line}L${sx(delta.distance[b]).toFixed(1)},${zero.toFixed(1)}L${sx(delta.distance[a]).toFixed(1)},${zero.toFixed(1)}Z`
    : "";
  const tv = ticks(-m, m, 4);
  const hv = hover != null ? delta.values[bisect(delta.distance, hover)] : null;

  return (
    <g>
      <defs>
        <clipPath id={`${clip}-above`}>
          <rect x={M.left} y={y} width={innerW} height={Math.max(0, zero - y)} />
        </clipPath>
        <clipPath id={`${clip}-below`}>
          <rect x={M.left} y={zero} width={innerW} height={Math.max(0, y + h - zero)} />
        </clipPath>
      </defs>
      <rect x={M.left} y={y} width={innerW} height={h} fill="var(--surface-2)" opacity={0.5} />
      {tv.map((t) => (
        <g key={t} aria-hidden>
          <line x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} stroke="var(--chart-grid)" />
          <text x={M.left - 6} y={sy(t)} dy="0.32em" textAnchor="end" {...AXIS_TEXT}>
            {t > 0 ? "+" : ""}
            {t.toFixed(Math.abs(m) < 0.5 ? 2 : 1)}
          </text>
        </g>
      ))}
      <path d={area} fill={delta.aColor} opacity={0.22} clipPath={`url(#${clip}-above)`} />
      <path d={area} fill={delta.bColor} opacity={0.22} clipPath={`url(#${clip}-below)`} />
      <path d={line} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
      <line x1={M.left} x2={M.left + innerW} y1={zero} y2={zero} stroke="var(--ink-3)" strokeDasharray="3 3" />
      <text x={M.left + 8} y={y + 14} fontSize={12} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-sans)">
        Gap
        <tspan fill="var(--ink-3)" fontWeight={400}>
          {" "}
          s · above zero {delta.aLabel} ahead
        </tspan>
      </text>
      {hv != null && (
        <text
          x={M.left + innerW - 8}
          y={y + 14}
          textAnchor="end"
          fontSize={12}
          fontWeight={700}
          fontFamily="var(--font-mono)"
          fill={hv >= 0 ? delta.aColor : delta.bColor}
        >
          {hv >= 0 ? delta.aLabel : delta.bLabel} +{Math.abs(hv).toFixed(3)}
        </text>
      )}
    </g>
  );
}
