"use client";

import Link from "next/link";

import { TeamStripe } from "@/components/f1/bits";
import { DriverAvatar } from "@/components/f1/driver-avatar";
import { QueryView } from "@/components/ui/primitives";
import { useStandings } from "@/lib/api/queries";
import { countryFlagEmoji, shortDate } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export function ChampionshipSnapshot() {
  const { season, round, queryString } = useSelection();
  const standings = useStandings(season, round);
  return (
    <QueryView query={standings}>
      {(data) => {
        const leader = data.drivers[0]?.points ?? 0;
        const teamLeader = data.constructors[0]?.points ?? 0;
        return (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold text-ink-2">Drivers after round {data.round}</h3>
                <Link href={`/standings?${queryString}`} className="text-xs text-ink-3 hover:text-team">
                  Full standings
                </Link>
              </div>
              <ol className="space-y-1">
                {data.drivers.slice(0, 5).map((d) => (
                  <li key={d.code} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="tnum w-4 text-right text-ink-3">{d.position}</span>
                    <DriverAvatar code={d.code} number={d.number} team={d.team} size="xs" />
                    <span className="w-9 font-bold">{d.code}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full" style={{ width: `${(d.points / (leader || 1)) * 100}%`, background: teamColor(d.team ?? d.team_id) }} />
                    </span>
                    <span className="tnum w-10 text-right font-semibold">{d.points}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-2">Constructors</h3>
              <ol className="space-y-1">
                {data.constructors.slice(0, 5).map((c) => (
                  <li key={c.team} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="tnum w-4 text-right text-ink-3">{c.position}</span>
                    <TeamStripe team={c.team ?? c.team_id} />
                    <span className="w-28 truncate">{c.team}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full" style={{ width: `${(c.points / (teamLeader || 1)) * 100}%`, background: teamColor(c.team ?? c.team_id) }} />
                    </span>
                    <span className="tnum w-10 text-right font-semibold">{c.points}</span>
                  </li>
                ))}
              </ol>
            </div>
            {data.source !== "jolpica" && (
              <p className="text-xs text-ink-3">
                Rebuilt from cached timing for rounds {data.rounds_included.join(", ")} only — the standings API was unreachable.
              </p>
            )}
          </div>
        );
      }}
    </QueryView>
  );
}

export function SeasonCalendar() {
  const { events, round, set } = useSelection();
  return (
    <ol className="scroll-thin flex snap-x gap-2 overflow-x-auto pb-2" aria-label="Season calendar">
      {events.map((e) => {
        const active = e.round === round;
        const disabled = e.status === "upcoming";
        return (
          <li key={e.round} className="snap-start">
            <button
              type="button"
              disabled={disabled}
              onClick={() => set({ round: e.round })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex h-[76px] w-[132px] flex-col justify-between rounded-md border px-3 py-2 text-left transition-colors",
                active ? "border-team bg-surface-3" : "border-line bg-surface hover:border-line-strong",
                disabled && "opacity-45",
              )}
            >
              <span className="flex items-center justify-between text-[11px] text-ink-3">
                <span className="tnum">R{e.round}</span>
                <span>{e.status === "live" ? "Live" : shortDate(e.date)}</span>
              </span>
              <span className="truncate text-[13px] leading-tight font-semibold text-ink">
                <span aria-hidden>{countryFlagEmoji(e.country)} </span>
                {e.location}
              </span>
              <span className="truncate text-[11px] text-ink-3">{e.format.includes("sprint") ? "Sprint weekend" : "Grand Prix"}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
