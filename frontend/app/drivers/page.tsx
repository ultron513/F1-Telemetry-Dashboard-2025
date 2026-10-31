"use client";

import Link from "next/link";

import { DriverAvatar } from "@/components/f1/driver-avatar";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { lapTime, ordinal } from "@/lib/format";
import { liveryGradient, teamTheme } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function DriversPage() {
  return (
    <SessionGate>
      <Drivers />
    </SessionGate>
  );
}

function Drivers() {
  const { summary, driver, set, queryString } = useSelection();
  if (!summary) return null;
  const results = new Map(summary.results.map((r) => [r.code, r]));
  // Group the grid by team, ordered by the team's best finisher.
  const teams = new Map<string, typeof summary.drivers>();
  [...summary.drivers]
    .sort((a, b) => (results.get(a.code)?.position ?? 99) - (results.get(b.code)?.position ?? 99))
    .forEach((d) => teams.set(d.team, [...(teams.get(d.team) ?? []), d]));

  return (
    <>
      <PageHeader
        title="Drivers"
        description="The grid for this session, team by team. Choosing a driver focuses every page on them and switches the dashboard into their team's colours."
      />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[...teams.entries()].map(([team, list]) => {
          const theme = teamTheme(team);
          return (
            <section key={team} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="relative h-12 overflow-hidden" style={{ background: liveryGradient(theme) }}>
                <div className="carbon absolute inset-0" aria-hidden />
                <h2 className="relative px-4 pt-3 text-[15px] font-bold italic text-white drop-shadow">{team}</h2>
              </div>
              <ul className="divide-y divide-line">
                {list.map((d) => {
                  const r = results.get(d.code);
                  const active = d.code === driver;
                  return (
                    <li key={d.code} className={cn("flex items-center gap-4 p-4", active && "bg-surface-3")}>
                      <DriverAvatar code={d.code} number={d.number} team={d.team} size="lg" className="!h-28 !w-24" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-ink-3">#{d.number} · {d.country_code ?? d.code}</div>
                        <div className="truncate text-lg font-bold italic">
                          {d.first_name} <span className="uppercase">{d.last_name}</span>
                        </div>
                        <div className="tnum mt-1 text-[13px] text-ink-2">
                          {r?.position ? ordinal(r.position) : "—"}
                          {r?.best_lap ? ` · best ${lapTime(r.best_lap)}` : ""}
                          {r?.points ? ` · ${r.points} pts` : ""}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => set({ driver: d.code })}
                            aria-pressed={active}
                            className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", active ? "bg-team text-on-team" : "border border-line text-ink-2 hover:border-team hover:text-ink")}
                          >
                            {active ? "Focused" : "Focus"}
                          </button>
                          <Link
                            href={`/telemetry?${queryString.replace(/driver=[A-Z]+/, `driver=${d.code}`)}`}
                            className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-team hover:text-ink"
                          >
                            Telemetry
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Panel title="Driver photos" className="mt-6">
        <p className="max-w-3xl text-[13.5px] text-ink-2">
          Cards show a generated portrait in team colours. To use real photos, add images you have the rights to use to{" "}
          <code className="rounded bg-surface-3 px-1 text-[12.5px]">frontend/public/drivers/</code> and map each driver code to its file in{" "}
          <code className="rounded bg-surface-3 px-1 text-[12.5px]">manifest.json</code>, for example{" "}
          <code className="rounded bg-surface-3 px-1 text-[12.5px]">{`{ "VER": "VER.webp" }`}</code>. Portrait crops around 3:4 fit best.
        </p>
      </Panel>
    </>
  );
}
