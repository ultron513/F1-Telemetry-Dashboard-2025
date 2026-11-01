"use client";

import Link from "next/link";

import { Tyre } from "@/components/f1/bits";
import { SessionReport } from "@/components/ai/report";
import { Classification } from "@/components/session/classification";
import { SessionHero } from "@/components/session/hero";
import { ChampionshipSnapshot, SeasonCalendar } from "@/components/session/season";
import { SessionGate } from "@/components/shell/page";
import { ALL_NAV } from "@/components/shell/nav";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/primitives";
import { useLapTable } from "@/lib/api/queries";
import { lapTime, ordinal } from "@/lib/format";
import { useSelection } from "@/state/selection";

export default function OverviewPage() {
  return (
    <SessionGate>
      <Overview />
    </SessionGate>
  );
}

function Overview() {
  const { summary } = useSelection();
  if (!summary) return null;
  return (
    <div className="space-y-5">
      <SessionHero summary={summary} />

      <SessionReport />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Classification" subtitle="Select a driver to retheme the dashboard around them" flush bodyClassName="px-3 pb-3 sm:px-4">
          <Classification summary={summary} />
        </Panel>
        <div className="space-y-5">
          <FocusCard />
          <Panel title="Championship">
            <ChampionshipSnapshot />
          </Panel>
        </div>
      </div>

      <Panel title="Season calendar" subtitle="Completed rounds can be opened; upcoming ones unlock after the weekend">
        <SeasonCalendar />
      </Panel>

      <JumpLinks />
    </div>
  );
}

function FocusCard() {
  const { key, focus, summary } = useSelection();
  const laps = useLapTable(key, focus?.code ?? null);
  const result = summary?.results.find((r) => r.code === focus?.code);
  if (!focus) return null;
  const stats = laps.data?.stats;
  return (
    <Panel accent title={`${focus.full_name}`} subtitle={`#${focus.number} · ${focus.team}`}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Result" value={result?.position ? ordinal(result.position) : "—"} sub={result?.status ?? undefined} emphasis />
        <Stat label="Best lap" value={lapTime(stats?.best_lap)} sub={stats?.theoretical_best ? `Ideal ${lapTime(stats.theoretical_best)}` : undefined} emphasis />
        <Stat label="Clean-lap median" value={lapTime(stats?.median_clean)} sub={stats ? `${stats.clean_laps} of ${stats.total_laps} laps` : undefined} />
        <Stat label="Spread (σ)" value={stats?.std_clean != null ? `${stats.std_clean.toFixed(3)}s` : "—"} sub={`${stats?.pit_stops ?? 0} pit stop${stats?.pit_stops === 1 ? "" : "s"}`} />
      </div>
      {laps.data && laps.data.stints.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-2">
          {laps.data.stints.map((s) => (
            <span key={s.stint} className="inline-flex items-center gap-1.5">
              <Tyre compound={s.compound} size={16} />
              <span className="tnum">L{s.start_lap}–{s.end_lap}</span>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

function JumpLinks() {
  const { queryString } = useSelection();
  const links = ALL_NAV.filter((n) => n.href !== "/" && n.href !== "/settings");
  return (
    <nav aria-label="Analysis pages" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((n) => {
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={`${n.href}?${queryString}`}
            className="group flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-team"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-ink-3 group-hover:text-team" aria-hidden />
            <span>
              <span className="block text-[14px] font-semibold text-ink">{n.label}</span>
              <span className="block text-[13px] text-ink-3">{n.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
