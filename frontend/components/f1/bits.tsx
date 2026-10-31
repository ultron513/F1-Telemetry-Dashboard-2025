import { compound as compoundInfo, MESSAGE_STYLE, TIMING, TRACK_STATUS } from "@/lib/f1";
import type { Grade, MessageKind } from "@/lib/api/types";
import { lapTime, sectorTime } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";

/** Tyre: coloured ring with the compound initial, like broadcast graphics. */
export function Tyre({ compound, size = 18, age, className }: { compound: string | null; size?: number; age?: number | null; className?: string }) {
  const c = compoundInfo(compound);
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={`${c.label}${age != null ? ` · ${age} laps old` : ""}`}>
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="8.2" fill="var(--surface-3)" stroke={c.color} strokeWidth="3.2" />
        <text x="10" y="13.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-sans)">
          {c.short}
        </text>
      </svg>
      {age != null && <span className="tnum text-[11px] text-ink-3">{age}</span>}
      <span className="sr-only">{c.label}</span>
    </span>
  );
}

/** Vertical team stripe used in timing towers and tables. */
export function TeamStripe({ team, color, className }: { team: string | null; color?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-4 w-1 shrink-0 rounded-full", className)}
      style={{ background: teamColor(team, color) }}
    />
  );
}

/** Only session-best (purple) and personal-best (green) are highlighted; slower laps stay in plain ink. */
export function gradeColor(g: Grade): string | undefined {
  if (!g || g === "yellow") return undefined;
  return TIMING[g];
}

/** Sector/lap time with purple/green/yellow timing-screen colouring. */
export function TimingCell({
  value,
  grade,
  kind = "sector",
  deleted,
}: {
  value: number | null;
  grade?: Grade;
  kind?: "sector" | "lap";
  deleted?: boolean;
}) {
  const text = kind === "lap" ? lapTime(value) : sectorTime(value);
  return (
    <span
      className={cn("tnum", deleted && "line-through opacity-50")}
      style={{ color: gradeColor(grade ?? null) ?? "var(--ink-2)" }}
      title={grade === "purple" ? "Session best" : grade === "green" ? "Personal best" : undefined}
    >
      {text}
    </span>
  );
}

export function FlagChip({ kind, label, className }: { kind: MessageKind; label?: string; className?: string }) {
  const s = MESSAGE_STYLE[kind];
  const chequered = kind === "chequered";
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1.5 rounded-[3px] px-1.5 text-[11px] font-semibold whitespace-nowrap", className)}
      style={{
        background: chequered
          ? "repeating-conic-gradient(#111 0 25%, #f2f2f2 0 50%) 0 0 / 8px 8px"
          : s.color,
        color: s.ink,
        boxShadow: kind === "double_yellow" ? "inset 3px 0 0 #1A1400, inset -3px 0 0 #1A1400" : undefined,
      }}
    >
      {chequered ? <span className="rounded-[2px] bg-[#111] px-1 text-white">{label}</span> : label}
    </span>
  );
}

export function TrackStatusPill({ status }: { status: string }) {
  const s = TRACK_STATUS[status] ?? TRACK_STATUS["1"];
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-[3px] px-2 text-xs font-bold"
      style={{ background: s.color, color: s.ink }}
    >
      {s.label}
    </span>
  );
}

export function PositionBadge({ position, className }: { position: number | null; className?: string }) {
  const podium = position != null && position <= 3;
  return (
    <span
      className={cn(
        "tnum inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-[3px] text-[13px] font-semibold",
        podium ? "bg-ink text-bg" : "bg-surface-3 text-ink-2",
        className,
      )}
    >
      {position ?? "–"}
    </span>
  );
}
