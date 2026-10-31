"use client";

import { Timer } from "lucide-react";

import { PositionBadge, TeamStripe } from "@/components/f1/bits";
import { DriverAvatar } from "@/components/f1/driver-avatar";
import type { SessionSummary } from "@/lib/api/types";
import { TIMING } from "@/lib/f1";
import { lapTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

/** Classification as a timing tower: click a row to focus that driver. */
export function Classification({ summary, limit }: { summary: SessionSummary; limit?: number }) {
  const { driver, vs, set } = useSelection();
  const kind = summary.session.kind;
  const rows = limit ? summary.results.slice(0, limit) : summary.results;
  const drivers = new Map(summary.drivers.map((d) => [d.code, d]));

  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="py-2 pr-2 pl-1 font-medium">Pos</th>
            <th className="py-2 font-medium">Driver</th>
            {kind === "race" && <th className="py-2 text-right font-medium">Grid</th>}
            {kind === "qualifying" ? (
              <>
                <th className="py-2 text-right font-medium">Q1</th>
                <th className="py-2 text-right font-medium">Q2</th>
                <th className="py-2 text-right font-medium">Q3</th>
              </>
            ) : (
              <th className="py-2 text-right font-medium">Best lap</th>
            )}
            <th className="py-2 text-right font-medium">{kind === "race" ? "Time / gap" : "Gap"}</th>
            {kind === "race" && <th className="py-2 pr-2 text-right font-medium">Pts</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = drivers.get(r.code);
            const isFocus = r.code === driver;
            const isVs = r.code === vs;
            return (
              <tr
                key={r.code}
                onClick={() => set({ driver: r.code })}
                className={cn(
                  "cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2",
                  isFocus && "bg-surface-3 hover:bg-surface-3",
                )}
              >
                <td className="py-1.5 pr-2 pl-1">
                  <PositionBadge position={r.position} />
                </td>
                <td className="py-1.5">
                  <span className="flex items-center gap-2.5">
                    <TeamStripe team={r.team} color={r.team_color} />
                    <DriverAvatar code={r.code} number={r.number} team={r.team} size="xs" />
                    <span className="w-9 font-bold">{r.code}</span>
                    <span className="hidden truncate text-ink-2 sm:inline">{d?.last_name || r.full_name}</span>
                    <span className="hidden truncate text-xs text-ink-3 md:inline">{r.team}</span>
                    {isFocus && <span className="rounded bg-team px-1.5 text-[10.5px] font-semibold text-on-team">Focus</span>}
                    {isVs && <span className="rounded border border-line-strong px-1.5 text-[10.5px] text-ink-2">Compare</span>}
                  </span>
                </td>
                {kind === "race" && <td className="tnum py-1.5 text-right text-ink-3">{r.grid ?? "—"}</td>}
                {kind === "qualifying" ? (
                  <>
                    <td className="tnum py-1.5 text-right text-ink-2">{lapTime(r.q1)}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{lapTime(r.q2)}</td>
                    <td className="tnum py-1.5 text-right text-ink">{lapTime(r.q3)}</td>
                  </>
                ) : (
                  <td className="tnum py-1.5 text-right" style={{ color: r.fastest_lap ? TIMING.purple : "var(--ink-2)" }}>
                    <span className="inline-flex items-center gap-1">
                      {r.fastest_lap && <Timer className="size-3.5" aria-label="Fastest lap" />}
                      {lapTime(r.best_lap)}
                    </span>
                  </td>
                )}
                <td className={cn("tnum py-1.5 text-right", r.position === 1 ? "text-ink" : "text-ink-2")}>{r.time_text ?? r.status ?? "—"}</td>
                {kind === "race" && <td className="tnum py-1.5 pr-2 text-right font-semibold">{r.points ? r.points : ""}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
