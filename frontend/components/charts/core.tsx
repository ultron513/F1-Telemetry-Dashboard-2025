"use client";

import { useEffect, useRef, useState } from "react";

/** Observe an element's content-box size. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export interface Scale {
  (v: number): number;
  invert: (px: number) => number;
  domain: [number, number];
  range: [number, number];
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const s = ((v: number) => r0 + (v - d0) * k) as Scale;
  s.invert = (px: number) => (k === 0 ? d0 : d0 + (px - r0) / k);
  s.domain = domain;
  s.range = range;
  return s;
}

/** "Nice" tick values (1, 2, 5 × 10^n steps). */
export function ticks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max)) return [];
  if (min === max) return [min];
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function extent(values: ArrayLike<number | null | undefined>): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo === Infinity ? [0, 1] : [lo, hi];
}

export function pad([lo, hi]: [number, number], frac = 0.06): [number, number] {
  const p = (hi - lo || Math.abs(hi) || 1) * frac;
  return [lo - p, hi + p];
}

/** Polyline path; nulls break the line. `step` draws horizontal-then-vertical segments. */
export function linePath(
  xs: ArrayLike<number>,
  ys: ArrayLike<number | null>,
  sx: Scale,
  sy: Scale,
  opts: { step?: boolean; from?: number; to?: number } = {},
): string {
  const from = opts.from ?? 0;
  const to = opts.to ?? xs.length - 1;
  let d = "";
  let pen = false;
  let prevY = 0;
  for (let i = from; i <= to; i++) {
    const yv = ys[i];
    if (yv == null || !isFinite(yv)) {
      pen = false;
      continue;
    }
    const x = sx(xs[i]);
    const y = sy(yv);
    if (!pen) {
      d += `M${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    } else if (opts.step) {
      d += `H${x.toFixed(1)}V${y.toFixed(1)}`;
    } else {
      d += `L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    prevY = y;
  }
  void prevY;
  return d;
}

/** Visible index window for a sorted x array within [lo, hi] (with one point of margin). */
export function windowIndices(xs: ArrayLike<number>, lo: number, hi: number): [number, number] {
  let a = 0;
  let b = xs.length - 1;
  while (a < b && xs[a + 1] < lo) a++;
  while (b > a && xs[b - 1] > hi) b--;
  return [a, b];
}

export const AXIS_TEXT = {
  fontSize: 11,
  fill: "var(--chart-axis)",
  fontFamily: "var(--font-mono)",
} as const;

export function GridLines({
  values,
  scale,
  x0,
  x1,
  format,
  labelSide = "left",
}: {
  values: number[];
  scale: Scale;
  x0: number;
  x1: number;
  format?: (v: number) => string;
  labelSide?: "left" | "right" | "none";
}) {
  return (
    <g aria-hidden>
      {values.map((v) => {
        const y = scale(v);
        return (
          <g key={v}>
            <line x1={x0} x2={x1} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            {labelSide !== "none" && (
              <text
                x={labelSide === "left" ? x0 - 6 : x1 + 6}
                y={y}
                dy="0.32em"
                textAnchor={labelSide === "left" ? "end" : "start"}
                {...AXIS_TEXT}
              >
                {format ? format(v) : v}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Floating tooltip positioned inside a relative container. */
export function ChartTooltip({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  width: number;
  children: React.ReactNode;
}) {
  const left = x > width - 200 ? x - 12 : x + 12;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 rounded-md border border-line-strong bg-surface/95 px-2.5 py-2 text-xs shadow-[var(--shadow-pop)] backdrop-blur"
      style={{ left, top: Math.max(0, y), transform: x > width - 200 ? "translateX(-100%)" : undefined }}
    >
      {children}
    </div>
  );
}

export function LegendSwatch({ color, dashed, label }: { color: string; dashed?: boolean; label: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <svg width="18" height="8" aria-hidden>
        <line x1="1" x2="17" y1="4" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? "4 3" : undefined} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}
