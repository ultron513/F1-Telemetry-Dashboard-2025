"use client";

import { SeasonPicker } from "@/components/shell/pickers";
import { PageHeader } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { QueryView } from "@/components/ui/primitives";
import { useTeammates } from "@/lib/api/queries";
import type { TeammatePair } from "@/lib/api/types";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function TeammatesPage() {
  const { season } = useSelection();
  const q = useTeammates(season);
  return (
    <>
      <PageHeader
        title="Team-mate battles"
        description="The only fair fight in F1: same car, same team. Qualifying and race head-to-heads, points and median race pace across every race weekend in the season warehouse."
        actions={<SeasonPicker className="w-[140px]" />}
      />
      <QueryView query={q}>
        {(d) => (
          <>
            <p className="mb-3 text-[13px] text-ink-3">
              {d.rounds.length} race weekend{d.rounds.length === 1 ? "" : "s"} analysed (rounds {d.rounds.join(", ")}). Every race you open is added automatically; the ingest job
              adds whole seasons.
            </p>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {d.pairs.map((p) => (
                <Pair key={`${p.team}-${p.drivers.join("-")}`} p={p} />
              ))}
            </div>
          </>
        )}
      </QueryView>
    </>
  );
}

function Duel({ label, values, names, color }: { label: string; values: number[]; names: string[]; color: string }) {
  const total = values[0] + values[1];
  const share = total ? values[0] / total : 0.5;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12.5px]">
        <span className={cn("tnum", values[0] > values[1] ? "font-semibold text-ink" : "text-ink-2")}>
          {names[0]} {values[0]}
        </span>
        <span className="text-ink-3">{label}</span>
        <span className={cn("tnum", values[1] > values[0] ? "font-semibold text-ink" : "text-ink-2")}>
          {values[1]} {names[1]}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
        <span style={{ width: `${share * 100}%`, background: color }} />
        <span style={{ width: `${(1 - share) * 100}%`, background: color, opacity: 0.35 }} />
      </div>
    </div>
  );
}

function Pair({ p }: { p: TeammatePair }) {
  const color = teamColor(p.team, p.team_color);
  const [a, b] = p.drivers;
  const pts = p.points.map((v) => v ?? 0);
  const faster = p.pace_gap == null ? null : p.pace_gap > 0 ? a : b;
  return (
    <Panel title={p.team} subtitle={`${p.races} race${p.races === 1 ? "" : "s"} together`} className="border-t-[3px]" style={{ borderTopColor: color }}>
      <div className="space-y-3">
        <Duel label="Qualifying" values={p.quali} names={[a, b]} color={color} />
        <Duel label="Race" values={p.race} names={[a, b]} color={color} />
        <Duel label="Points" values={pts.map((v) => Math.round(v))} names={[a, b]} color={color} />
        <div className="flex items-baseline justify-between border-t border-line pt-2.5 text-[13px]">
          <span className="text-ink-3">Median race pace</span>
          <span className="tnum text-ink">
            {faster ? (
              <>
                <strong>{faster}</strong> {Math.abs(p.pace_gap ?? 0).toFixed(3)} s/lap quicker
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1" aria-label="Race results by round">
          {p.rounds.map((r) => (
            <li
              key={r.round}
              title={`Round ${r.round}: ${r.race ? `${r.race} ahead in the race` : "no race comparison"}${r.quali ? `, ${r.quali} ahead in ${r.quali_source}` : ""}`}
              className="flex size-6 items-center justify-center rounded text-[10.5px] font-semibold"
              style={{ background: r.race === a ? color : "var(--surface-3)", color: r.race === a ? "var(--surface)" : "var(--ink-2)" }}
            >
              {r.round}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
