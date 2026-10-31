"use client";

import { useMemo, useState } from "react";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { TeamStripe } from "@/components/f1/bits";
import { DriverAvatar } from "@/components/f1/driver-avatar";
import { PageHeader } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { QueryView, Segmented } from "@/components/ui/primitives";
import { useStandings } from "@/lib/api/queries";
import type { StandingsResponse } from "@/lib/api/types";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function StandingsPage() {
  const { season, round } = useSelection();
  const [scope, setScope] = useState<"latest" | "round">("latest");
  const standings = useStandings(season, scope === "round" ? round : null);
  return (
    <>
      <PageHeader
        title="Standings"
        description="The drivers' and constructors' championships, and how the points piled up round by round."
        actions={
          <Segmented
            label="Standings point in time"
            value={scope}
            onChange={setScope}
            options={[
              { value: "latest", label: "Latest" },
              { value: "round", label: `After round ${round ?? "—"}` },
            ]}
          />
        }
      />
      <QueryView query={standings}>{(d) => <Body d={d} />}</QueryView>
    </>
  );
}

function Body({ d }: { d: StandingsResponse }) {
  const { driver, set, drivers } = useSelection();
  const [view, setView] = useState<"drivers" | "constructors">("drivers");
  const sessionCodes = new Set(drivers.map((x) => x.code));
  const leader = d.drivers[0]?.points ?? 0;
  const teamLeader = d.constructors[0]?.points ?? 0;

  const teamOf = useMemo(() => new Map(d.drivers.map((x) => [x.code, x.team ?? x.team_id])), [d]);
  const series: LineSeries[] = useMemo(() => {
    const rounds = d.progression.rounds.map((r) => r.round);
    if (view === "drivers") {
      const top = d.drivers.slice(0, 10).map((x) => x.code);
      const seen = new Map<string, number>();
      return top.map((code) => {
        const color = teamColor(teamOf.get(code));
        const n = seen.get(color) ?? 0;
        seen.set(color, n + 1);
        return {
          id: code,
          label: code,
          color,
          dashed: n > 0,
          width: code === driver ? 3 : 1.8,
          points: (d.progression.drivers[code] ?? []).map((v, i) => ({ x: rounds[i], y: v })),
        };
      });
    }
    return d.constructors.slice(0, 10).map((c) => ({
      id: c.team,
      label: c.team.split(" ")[0],
      color: teamColor(c.team ?? c.team_id),
      points: (d.progression.constructors[c.team] ?? []).map((v, i) => ({ x: rounds[i], y: v })),
    }));
  }, [d, view, teamOf, driver]);

  const roundName = new Map(d.progression.rounds.map((r) => [r.round, r.name]));

  return (
    <div className="space-y-4">
      {d.source !== "jolpica" && (
        <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-ink">
          The standings service couldn&rsquo;t be reached, so these tables are rebuilt from cached sessions only (rounds {d.rounds_included.join(", ")}).
        </p>
      )}
      <Panel
        accent
        title="Points progression"
        subtitle={view === "drivers" ? "Top ten drivers; teammates share a colour, the second is dashed" : "Top ten constructors"}
        actions={
          <Segmented
            size="sm"
            label="Championship"
            value={view}
            onChange={setView}
            options={[
              { value: "drivers", label: "Drivers" },
              { value: "constructors", label: "Constructors" },
            ]}
          />
        }
      >
        <LineChart
          series={series}
          height={360}
          xFormat={(v) => `R${v}`}
          tooltipX={(v) => `After ${roundName.get(v) ?? `round ${v}`}`}
          yFormat={(v) => String(Math.round(v))}
          highlight={view === "drivers" && driver ? new Set([driver]) : null}
          endLabels
          ariaLabel="Championship points progression by round"
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Drivers' championship" subtitle={`After round ${d.round}`} flush bodyClassName="px-2 pb-2">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="py-2 pl-2 font-medium">Pos</th>
                  <th className="py-2 font-medium">Driver</th>
                  <th className="py-2 text-right font-medium">Wins</th>
                  <th className="py-2 text-right font-medium">Podiums</th>
                  <th className="py-2 text-right font-medium">Gap</th>
                  <th className="py-2 pr-2 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {d.drivers.map((x) => {
                  const selectable = sessionCodes.has(x.code);
                  return (
                    <tr
                      key={x.code}
                      onClick={() => selectable && set({ driver: x.code })}
                      className={cn("border-b border-line/50 last:border-0", selectable && "cursor-pointer hover:bg-surface-2", x.code === driver && "bg-surface-3")}
                    >
                      <td className="tnum py-1.5 pl-2 text-ink-3">{x.position}</td>
                      <td className="py-1.5">
                        <span className="flex items-center gap-2.5">
                          <TeamStripe team={x.team ?? x.team_id} />
                          <DriverAvatar code={x.code} number={x.number} team={x.team ?? x.team_id} size="xs" />
                          <span className="font-semibold">{x.full_name}</span>
                          <span className="hidden truncate text-xs text-ink-3 md:inline">{x.team}</span>
                        </span>
                      </td>
                      <td className="tnum py-1.5 text-right text-ink-2">{x.wins || ""}</td>
                      <td className="tnum py-1.5 text-right text-ink-2">{x.podiums || ""}</td>
                      <td className="tnum py-1.5 text-right text-ink-3">{x.position === 1 || leader === x.points ? "—" : `−${leader - x.points}`}</td>
                      <td className="tnum py-1.5 pr-2 text-right font-semibold">{x.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Constructors' championship" subtitle={`After round ${d.round}`}>
          <ol className="space-y-2">
            {d.constructors.map((c) => (
              <li key={c.team} className="grid grid-cols-[1.4rem_minmax(0,9rem)_1fr_3.2rem] items-center gap-3 text-[13.5px]">
                <span className="tnum text-right text-ink-3">{c.position}</span>
                <span className="flex items-center gap-2 truncate">
                  <TeamStripe team={c.team ?? c.team_id} />
                  {c.team}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full" style={{ width: `${(c.points / (teamLeader || 1)) * 100}%`, background: teamColor(c.team ?? c.team_id) }} />
                </span>
                <span className="tnum text-right font-semibold">{c.points}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
