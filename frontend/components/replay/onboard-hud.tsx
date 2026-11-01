"use client";

import type { OnboardResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const LEDS = 15;
const MAX_SPEED = 360;

/** Broadcast-style onboard graphic, driven by the replay clock. */
export function OnboardHud({ data, t, color, className }: { data: OnboardResponse; t: number; color: string; className?: string }) {
  const f = Math.min(data.frames - 1, Math.max(0, (t - data.start) / data.step));
  const i0 = Math.floor(f);
  const i1 = Math.min(data.frames - 1, i0 + 1);
  const w = f - i0;
  const lerp = (a: number[]) => a[i0] * (1 - w) + a[i1] * w;
  const speed = lerp(data.speed);
  const rpm = lerp(data.rpm);
  const throttle = lerp(data.throttle);
  const brake = data.brake[w < 0.5 ? i0 : i1];
  const gear = data.gear[w < 0.5 ? i0 : i1];
  const drs = data.drs[w < 0.5 ? i0 : i1];

  // 270° speed arc.
  const R = 62;
  const start = (135 * Math.PI) / 180;
  const sweep = (270 * Math.PI) / 180;
  const arc = (frac: number) => {
    const a0 = start;
    const a1 = start + sweep * Math.max(0.001, Math.min(1, frac));
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${80 + R * Math.cos(a0)} ${80 + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${80 + R * Math.cos(a1)} ${80 + R * Math.sin(a1)}`;
  };
  const lit = Math.round((rpm / Math.max(1, data.max_rpm)) * LEDS * 1.08 - LEDS * 0.25);

  return (
    <div className={cn("flex items-center gap-4 rounded-lg border border-line bg-surface-2 px-4 py-3", className)} aria-label={`${data.driver.code} onboard: ${Math.round(speed)} km/h, gear ${gear}`}>
      <svg viewBox="0 0 160 150" className="w-[150px] shrink-0">
        <path d={arc(1)} fill="none" stroke="var(--surface-3)" strokeWidth={10} strokeLinecap="round" />
        <path d={arc(speed / MAX_SPEED)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        <text x={80} y={78} textAnchor="middle" fontSize={34} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-mono)">
          {Math.round(speed)}
        </text>
        <text x={80} y={96} textAnchor="middle" fontSize={11} fill="var(--ink-3)" fontFamily="var(--font-sans)">
          km/h
        </text>
        <text x={80} y={138} textAnchor="middle" fontSize={26} fontWeight={700} fill={color} fontFamily="var(--font-mono)">
          {gear === 0 ? "N" : gear}
        </text>
      </svg>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: LEDS }, (_, i) => (
            <span
              key={i}
              className="h-2.5 flex-1 rounded-full transition-colors"
              style={{
                background: i < lit ? (i < 5 ? "#22c55e" : i < 10 ? "#ef4444" : "#8b5cf6") : "var(--surface-3)",
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-[12px]">
          <span className="text-ink-3">Throttle</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-good" style={{ width: `${throttle}%` }} />
          </span>
          <span className="tnum text-right text-ink">{Math.round(throttle)}%</span>
          <span className="text-ink-3">Brake</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-bad" style={{ width: brake ? "100%" : "0%" }} />
          </span>
          <span className="tnum text-right text-ink">{brake ? "ON" : "—"}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="tnum text-ink-2">{Math.round(rpm).toLocaleString()} rpm</span>
          <span className={cn("rounded px-2 py-0.5 font-semibold", drs ? "bg-good text-[#04140a]" : "bg-surface-3 text-ink-3")}>DRS</span>
          <span className="font-semibold text-ink">{data.driver.code}</span>
        </div>
      </div>
    </div>
  );
}
