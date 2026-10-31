"use client";

import { forwardRef, useMemo } from "react";

import { bisect } from "@/lib/utils";

import { useSize } from "./core";

export type TrackMode = "plain" | "speed" | "gear" | "throttle" | "dominance";

export interface TrackTrace {
  distance: number[];
  x: number[];
  y: number[];
  speed?: number[];
  gear?: number[];
  throttle?: number[];
  brake?: number[];
}

export interface TrackCar {
  code: string;
  color: string;
  /** Fraction of the lap 0..1. */
  frac: number;
  highlight?: boolean;
  dim?: boolean;
}

interface Props {
  outline: { x: number[]; y: number[]; distance: number[] };
  rotation: number;
  corners?: { number: number | null; letter: string; x: number | null; y: number | null }[];
  mode?: TrackMode;
  trace?: TrackTrace;
  rampColor?: string;
  dominance?: { start: number; end: number; winner: "a" | "b" | "even" }[];
  dominanceColors?: { a: string; b: string };
  markers?: { color: string; distance: number; trace?: TrackTrace; label?: string }[];
  cars?: TrackCar[];
  sectorMarks?: number[];
  drsZones?: { start: number; end: number }[];
  height?: number;
  showCorners?: boolean;
  ariaLabel?: string;
}

const PAD = 28;

/** Hex colour interpolation in linear-ish RGB. */
export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(Math.sqrt(v * v * (1 - t) + pb[i] * pb[i] * t)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const RAMP_LOW = "#2B313C";

/** Sequential single-hue ramp: dark tint → team colour → near white. */
export function ramp(color: string, t: number): string {
  const v = Math.min(1, Math.max(0, t));
  return v < 0.55 ? mix(RAMP_LOW, color, v / 0.55) : mix(color, "#F4F6F8", ((v - 0.55) / 0.45) * 0.75);
}

export const TrackMap = forwardRef<SVGSVGElement, Props>(function TrackMap(
  {
    outline,
    rotation,
    corners = [],
    mode = "plain",
    trace,
    rampColor = "#E10600",
    dominance,
    dominanceColors,
    markers = [],
    cars = [],
    sectorMarks = [],
    drsZones = [],
    height: maxHeight = 420,
    showCorners = true,
    ariaLabel = "Circuit map",
  },
  ref,
) {
  const [wrapRef, { width }] = useSize<HTMLDivElement>();

  const bounds = useMemo(() => {
    const rad = (rotation / 180) * Math.PI;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rot = (x: number, y: number): [number, number] => [x * cos - y * sin, x * sin + y * cos];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < outline.x.length; i++) {
      const [x, y] = rot(outline.x[i], outline.y[i]);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { rot, minX, maxX, minY, maxY };
  }, [outline, rotation]);

  // Fit height to the circuit's shape so wide tracks don't leave empty bands.
  const w0 = Math.max(1, width);
  const aspect = (bounds.maxY - bounds.minY) / (bounds.maxX - bounds.minX || 1);
  const height = Math.round(Math.min(maxHeight, Math.max(220, (w0 - PAD * 2) * aspect + PAD * 2 + 24)));

  const geo = useMemo(() => {
    const { rot, minX, maxX, minY, maxY } = bounds;
    const w = Math.max(1, width);
    const scale = Math.min((w - PAD * 2) / (maxX - minX || 1), (height - PAD * 2) / (maxY - minY || 1));
    const offX = (w - (maxX - minX) * scale) / 2;
    const offY = (height - (maxY - minY) * scale) / 2;
    const project = (x: number, y: number): [number, number] => {
      const [rx, ry] = rot(x, y);
      return [offX + (rx - minX) * scale, height - (offY + (ry - minY) * scale)];
    };
    const screen = outline.x.map((x, i) => project(x, outline.y[i]));
    const cx = screen.reduce((s, p) => s + p[0], 0) / screen.length;
    const cy = screen.reduce((s, p) => s + p[1], 0) / screen.length;
    return { project, screen, center: [cx, cy] as [number, number] };
  }, [bounds, outline, width, height]);

  const path = useMemo(
    () => geo.screen.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z",
    [geo],
  );

  const total = outline.distance[outline.distance.length - 1] || 1;

  const atDistance = (d: number, src?: TrackTrace): [number, number] => {
    const s = src ?? { ...outline, distance: outline.distance };
    const dd = src ? d : ((d % total) + total) % total;
    const i = bisect(s.distance, dd);
    const j = Math.min(s.distance.length - 1, i + 1);
    const span = s.distance[j] - s.distance[i] || 1;
    const t = Math.min(1, Math.max(0, (dd - s.distance[i]) / span));
    return geo.project(s.x[i] + (s.x[j] - s.x[i]) * t, s.y[i] + (s.y[j] - s.y[i]) * t);
  };

  const segments = useMemo(() => {
    if (!trace || mode === "plain") return null;
    const out: { d: string; color: string }[] = [];
    const n = trace.x.length;
    const stride = Math.max(1, Math.floor(n / 900));
    let spMin = Infinity, spMax = -Infinity;
    if (mode === "speed" && trace.speed) {
      for (const v of trace.speed) { spMin = Math.min(spMin, v); spMax = Math.max(spMax, v); }
    }
    for (let i = 0; i + stride < n; i += stride) {
      const [x0, y0] = geo.project(trace.x[i], trace.y[i]);
      const [x1, y1] = geo.project(trace.x[i + stride], trace.y[i + stride]);
      let color = "var(--ink-3)";
      if (mode === "speed" && trace.speed) {
        color = ramp(rampColor, (trace.speed[i] - spMin) / (spMax - spMin || 1));
      } else if (mode === "gear" && trace.gear) {
        color = ramp(rampColor, Math.max(0, (trace.gear[i] - 1) / 7));
      } else if (mode === "throttle" && trace.throttle) {
        if (trace.brake?.[i]) color = "#FF4D5E";
        else if (trace.throttle[i] >= 98) color = rampColor;
        else color = "#7A8392";
      } else if (mode === "dominance" && dominance && dominanceColors) {
        const d = trace.distance[i];
        const m = dominance.find((s) => d >= s.start && d < s.end) ?? dominance[dominance.length - 1];
        color = m.winner === "a" ? dominanceColors.a : m.winner === "b" ? dominanceColors.b : "#7A8392";
      }
      out.push({ d: `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`, color });
    }
    return out;
  }, [trace, mode, geo, rampColor, dominance, dominanceColors]);

  const cornerLabels = useMemo(() => {
    if (!showCorners) return [];
    const [cx, cy] = geo.center;
    return corners
      .filter((c) => c.x != null && c.y != null)
      .map((c) => {
        const [x, y] = geo.project(c.x as number, c.y as number);
        const dx = x - cx;
        const dy = y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return { key: `${c.number}${c.letter}`, x: x + (dx / len) * 16, y: y + (dy / len) * 16, ax: x, ay: y };
      });
  }, [corners, geo, showCorners]);

  const startPt = geo.screen[0];
  const nextPt = geo.screen[Math.min(3, geo.screen.length - 1)];
  const startAngle = startPt && nextPt ? (Math.atan2(nextPt[1] - startPt[1], nextPt[0] - startPt[0]) * 180) / Math.PI : 0;

  return (
    <div ref={wrapRef} className="w-full">
      {width > 0 && (
        <svg ref={ref} width={width} height={height} role="img" aria-label={ariaLabel}>
          <path d={path} fill="none" stroke="var(--line-strong)" strokeWidth={12} strokeLinejoin="round" opacity={0.55} />
          <path d={path} fill="none" stroke="var(--surface-3)" strokeWidth={7} strokeLinejoin="round" />

          {drsZones.map((z) => {
            const steps = 24;
            let dz = "";
            for (let k = 0; k <= steps; k++) {
              const [x, y] = atDistance(z.start + ((z.end - z.start) * k) / steps);
              dz += `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
            }
            return <path key={z.start} d={dz} fill="none" stroke="#22D3EE" strokeWidth={13} strokeLinecap="round" opacity={0.28} />;
          })}

          {segments
            ? segments.map((s, i) => <path key={i} d={s.d} stroke={s.color} strokeWidth={5} strokeLinecap="round" />)
            : <path d={path} fill="none" stroke="var(--ink-3)" strokeWidth={2.5} strokeLinejoin="round" />}

          {sectorMarks.map((d, i) => {
            const [x, y] = atDistance(d);
            return (
              <g key={d}>
                <circle cx={x} cy={y} r={5} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
                <text x={x + 9} y={y - 7} fontSize={10.5} fill="var(--ink-2)" fontFamily="var(--font-mono)">
                  S{i + 2}
                </text>
              </g>
            );
          })}

          {/* Start/finish line. */}
          {startPt && (
            <g transform={`translate(${startPt[0]},${startPt[1]}) rotate(${startAngle + 90})`}>
              <rect x={-9} y={-2} width={18} height={4} fill="var(--ink)" />
              <rect x={-9} y={-2} width={4.5} height={2} fill="var(--bg)" />
              <rect x={0} y={-2} width={4.5} height={2} fill="var(--bg)" />
              <rect x={-4.5} y={0} width={4.5} height={2} fill="var(--bg)" />
              <rect x={4.5} y={0} width={4.5} height={2} fill="var(--bg)" />
            </g>
          )}

          {cornerLabels.map((c) => (
            <g key={c.key} aria-hidden>
              <line x1={c.ax} y1={c.ay} x2={c.x} y2={c.y} stroke="var(--line-strong)" strokeWidth={1} />
              <circle cx={c.x} cy={c.y} r={8} fill="var(--surface)" stroke="var(--line-strong)" />
              <text x={c.x} y={c.y} dy="0.34em" textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--ink-2)" fontFamily="var(--font-sans)">
                {c.key}
              </text>
            </g>
          ))}

          {cars
            .slice()
            .sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight))
            .map((car) => {
              const [x, y] = atDistance(car.frac * total);
              return (
                <g key={car.code} opacity={car.dim ? 0.35 : 1} style={{ transition: "opacity 200ms" }}>
                  <circle cx={x} cy={y} r={car.highlight ? 8 : 6} fill={car.color} stroke="var(--bg)" strokeWidth={2} />
                  {(car.highlight || cars.length <= 6) && (
                    <text x={x + 10} y={y - 8} fontSize={11} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-sans)" paintOrder="stroke" stroke="var(--bg)" strokeWidth={3}>
                      {car.code}
                    </text>
                  )}
                </g>
              );
            })}

          {markers.map((m, i) => {
            const [x, y] = atDistance(m.distance, m.trace);
            return (
              <g key={i} pointerEvents="none">
                <circle cx={x} cy={y} r={9} fill={m.color} opacity={0.25} />
                <circle cx={x} cy={y} r={5.5} fill={m.color} stroke="var(--bg)" strokeWidth={2} />
                {m.label && (
                  <text x={x + 11} y={y + (i ? 14 : -8)} fontSize={11} fontWeight={700} fill={m.color} fontFamily="var(--font-sans)" paintOrder="stroke" stroke="var(--bg)" strokeWidth={3}>
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
});
