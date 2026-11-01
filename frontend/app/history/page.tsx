"use client";

import { Search, Trophy } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { PageHeader } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Empty, QueryView, Segmented, Stat } from "@/components/ui/primitives";
import { useCareer, useChampions, useCircuitHistory, useHistoryCircuits, useHistoryDrivers } from "@/lib/api/queries";
import type { CareerResponse, ChampionsResponse, CircuitHistoryResponse } from "@/lib/api/types";
import { lapTime, ordinal } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";

type Tab = "champions" | "drivers" | "circuits";

/** History lives in the URL too (?tab=drivers&driver=hamilton), so it can be shared. */
function useHistoryParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return {
    tab: (params.get("tab") as Tab) || "champions",
    driver: params.get("driver"),
    circuit: params.get("circuit"),
    set,
  };
}

export default function HistoryPage() {
  const { tab, set } = useHistoryParams();
  return (
    <>
      <PageHeader
        title="History"
        description="Every championship since 1950: world champions, any driver's career and how each circuit's pole times have fallen across the eras."
        actions={
          <Segmented
            label="History section"
            value={tab}
            onChange={(v) => set({ tab: v })}
            options={[
              { value: "champions", label: "Champions" },
              { value: "drivers", label: "Drivers" },
              { value: "circuits", label: "Circuits" },
            ]}
          />
        }
      />
      {tab === "champions" && <Champions />}
      {tab === "drivers" && <Drivers />}
      {tab === "circuits" && <Circuits />}
    </>
  );
}

// --- Champions --------------------------------------------------------------------

function Champions() {
  const q = useChampions();
  const { set } = useHistoryParams();
  return <QueryView query={q}>{(d) => <ChampionsView data={d} onDriver={(id) => set({ tab: "drivers", driver: id })} />}</QueryView>;
}

function ChampionsView({ data, onDriver }: { data: ChampionsResponse; onDriver: (id: string) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel accent title="World champions" subtitle={`${data.seasons.length} seasons. Select a champion to open their career.`} flush bodyClassName="pb-2">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-3 uppercase">
                <th className="py-2 pl-5 font-medium">Season</th>
                <th className="py-2 font-medium">Drivers&apos; champion</th>
                <th className="py-2 text-right font-medium">Points</th>
                <th className="py-2 text-right font-medium">Wins</th>
                <th className="py-2 pr-5 pl-6 font-medium">Constructors&apos; champion</th>
              </tr>
            </thead>
            <tbody>
              {data.seasons.map((s) => (
                <tr key={s.season} className="border-b border-line/60 hover:bg-surface-2">
                  <td className="tnum py-1.5 pl-5 font-semibold text-ink">
                    {s.season}
                    {!s.decided && <span className="ml-2 rounded bg-surface-3 px-1.5 py-px text-[10.5px] font-medium text-ink-3">leading</span>}
                  </td>
                  <td className="py-1.5">
                    <button type="button" onClick={() => onDriver(s.driver.id)} className="text-left hover:text-team">
                      <span className="font-medium text-ink">{s.driver.name}</span> <span className="text-ink-3">· {s.driver.team}</span>
                    </button>
                  </td>
                  <td className="tnum py-1.5 text-right text-ink-2">{s.driver.points}</td>
                  <td className="tnum py-1.5 text-right text-ink-2">{s.driver.wins}</td>
                  <td className="py-1.5 pr-5 pl-6 text-ink-2">
                    {s.constructor ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-1 rounded-full" style={{ background: teamColor(s.constructor.name) }} />
                        {s.constructor.name}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="space-y-4">
        <TitleList title="Most drivers' titles" rows={data.most_driver_titles} />
        <TitleList title="Most constructors' titles" rows={data.most_constructor_titles} team />
      </div>
    </div>
  );
}

function TitleList({ title, rows, team }: { title: string; rows: { name: string; titles: number }[]; team?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.titles));
  return (
    <Panel title={title}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,9rem)_1fr_1.5rem] items-center gap-3 text-[13px]">
            <span className="truncate text-ink">{r.name}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: `${(r.titles / max) * 100}%`, background: team ? teamColor(r.name) : "var(--team-primary)" }} />
            </span>
            <span className="tnum text-right text-ink">{r.titles}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// --- Drivers ----------------------------------------------------------------------

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Drivers() {
  const { driver, set } = useHistoryParams();
  const [search, setSearch] = useState("");
  const q = useHistoryDrivers(useDebounced(search));
  const career = useCareer(driver);
  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Panel title="Find a driver" subtitle="Every championship starter since 1950" flush bodyClassName="pb-2">
        <label className="mx-4 mb-2 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 sm:mx-5">
          <Search className="size-4 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Senna, Hamilton, VER…" className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-ink-3" aria-label="Search drivers" />
        </label>
        <QueryView query={q}>
          {(d) => (
            <ul className="max-h-[62vh] overflow-y-auto">
              {d.drivers.slice(0, 200).map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => set({ driver: x.id })}
                    className={cn("flex w-full items-baseline justify-between gap-2 px-5 py-1.5 text-left text-[13px] hover:bg-surface-2", driver === x.id && "bg-surface-3")}
                  >
                    <span className="truncate text-ink">{x.name}</span>
                    <span className="shrink-0 text-[11.5px] text-ink-3">{x.nationality}</span>
                  </button>
                </li>
              ))}
              {d.drivers.length === 0 && <Empty>No driver matches “{search}”.</Empty>}
            </ul>
          )}
        </QueryView>
      </Panel>
      {driver ? (
        <QueryView query={career}>{(c) => <Career data={c} />}</QueryView>
      ) : (
        <Panel>
          <Empty>Pick a driver to see their career.</Empty>
        </Panel>
      )}
    </div>
  );
}

function Career({ data }: { data: CareerResponse }) {
  const t = data.totals;
  const span = data.seasons.length ? [data.seasons[0].season, data.seasons[data.seasons.length - 1].season] : null;
  const first = span?.[0] ?? 0;
  const years = span ? span[1] - span[0] + 1 : 1;
  const series: LineSeries[] = [
    {
      id: "pos",
      label: "Championship position",
      color: "var(--team-primary)",
      kind: "line",
      width: 2,
      points: data.seasons.map((s) => ({ x: s.season, y: s.championship })),
    },
  ];
  return (
    <div className="space-y-4">
      <Panel accent share={data.driver.name} title={data.driver.name} subtitle={[data.driver.nationality, data.driver.born && `born ${data.driver.born}`, data.driver.number && `#${data.driver.number}`].filter(Boolean).join(" · ")}>
        {t.titles > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Trophy className="size-4 text-warn" />
            {t.title_years.map((y) => (
              <span key={y} className="rounded bg-warn/15 px-2 py-0.5 text-[12.5px] font-semibold text-ink">
                {y}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Titles" value={t.titles} emphasis />
          <Stat label="Starts" value={t.starts} />
          <Stat label="Wins" value={t.wins} sub={`${t.win_rate}%`} />
          <Stat label="Podiums" value={t.podiums} sub={`${t.podium_rate}%`} />
          <Stat label="Poles" value={t.poles} />
          <Stat label="Fastest laps" value={t.fastest_laps} />
          <Stat label="Points" value={t.points.toLocaleString()} />
          <Stat label="Best finish" value={t.best_finish ? ordinal(t.best_finish) : "—"} />
        </div>
        <div className="mt-5">
          <div className="mb-1.5 text-[12.5px] text-ink-3">
            Teams · {data.first_race?.season}–{data.last_race?.season}
          </div>
          <div className="relative h-7 overflow-hidden rounded-md bg-surface-3">
            {data.teams.map((tm, i) => (
              <span
                key={`${tm.team}-${tm.from}-${i}`}
                className="absolute top-0 flex h-full items-center overflow-hidden border-r-2 border-surface px-2 text-[11.5px] font-semibold whitespace-nowrap text-white"
                style={{ left: `${((tm.from - first) / years) * 100}%`, width: `${((tm.to - tm.from + 1) / years) * 100}%`, background: teamColor(tm.team) }}
                title={`${tm.team} ${tm.from}–${tm.to}`}
              >
                {tm.team}
              </span>
            ))}
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel share title="Championship finishes" subtitle="Final standing each season (lower is better)">
          <LineChart ariaLabel="Championship position by season" series={series} height={240} invertY xFormat={(v) => String(v)} yFormat={(v) => (Number.isInteger(v) ? ordinal(v) : "")} tooltipX={(v) => String(v)} />
        </Panel>
        <Panel title="Season by season" flush bodyClassName="pb-2">
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-3 uppercase">
                  <th className="py-2 pl-5 font-medium">Year</th>
                  <th className="py-2 font-medium">Team</th>
                  <th className="py-2 text-right font-medium">Races</th>
                  <th className="py-2 text-right font-medium">Wins</th>
                  <th className="py-2 text-right font-medium">Pod.</th>
                  <th className="py-2 text-right font-medium">Pts</th>
                  <th className="py-2 pr-5 text-right font-medium">Final</th>
                </tr>
              </thead>
              <tbody>
                {[...data.seasons].reverse().map((s) => (
                  <tr key={s.season} className="border-b border-line/60">
                    <td className="tnum py-1.5 pl-5 font-medium text-ink">{s.season}</td>
                    <td className="max-w-[10rem] truncate py-1.5 text-ink-2">{s.teams.join(", ")}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{s.races}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{s.wins}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{s.podiums}</td>
                    <td className="tnum py-1.5 text-right text-ink-2">{s.points}</td>
                    <td className={cn("tnum py-1.5 pr-5 text-right", s.championship === 1 ? "font-semibold text-warn" : "text-ink")}>{s.championship ? ordinal(s.championship) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// --- Circuits ---------------------------------------------------------------------

function Circuits() {
  const { circuit, set } = useHistoryParams();
  const [search, setSearch] = useState("");
  const list = useHistoryCircuits();
  const detail = useCircuitHistory(circuit);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data?.circuits ?? []).filter((c) => !q || `${c.name} ${c.locality} ${c.country}`.toLowerCase().includes(q));
  }, [list.data, search]);
  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Panel title="Circuits" subtitle="Every track used since 1950" flush bodyClassName="pb-2">
        <label className="mx-4 mb-2 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 sm:mx-5">
          <Search className="size-4 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Monza, Japan…" className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-ink-3" aria-label="Search circuits" />
        </label>
        <QueryView query={list}>
          {() => (
            <ul className="max-h-[62vh] overflow-y-auto">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => set({ circuit: c.id })}
                    className={cn("block w-full px-5 py-1.5 text-left text-[13px] hover:bg-surface-2", circuit === c.id && "bg-surface-3")}
                  >
                    <span className="block truncate text-ink">{c.name}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {c.locality}, {c.country}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Panel>
      {circuit ? (
        <QueryView query={detail}>{(d) => <CircuitView data={d} />}</QueryView>
      ) : (
        <Panel>
          <Empty>Pick a circuit to see every winner and how pole times have fallen.</Empty>
        </Panel>
      )}
    </div>
  );
}

function CircuitView({ data }: { data: CircuitHistoryResponse }) {
  const series: LineSeries[] = [
    {
      id: "pole",
      label: "Pole time",
      color: "var(--team-primary)",
      kind: "line",
      width: 2,
      points: data.pole_times.map((p) => ({ x: p.season, y: p.time, meta: `${p.driver} · ${p.team}` })),
    },
  ];
  return (
    <div className="space-y-4">
      <Panel accent title={data.circuit.name} subtitle={`${data.circuit.locality}, ${data.circuit.country}`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Grands Prix" value={data.races} sub={data.first ? `${data.first}–${data.last}` : undefined} />
          <Stat label="Won from pole" value={data.pole_win_rate != null ? `${data.pole_win_rate}%` : "—"} sub={`${data.wins_from_pole} times`} />
          <Stat label="Pole record" value={lapTime(data.pole_record?.time)} sub={data.pole_record ? `${data.pole_record.driver}, ${data.pole_record.season}` : undefined} emphasis />
          <Stat label="Most wins" value={data.most_wins[0]?.wins ?? "—"} sub={data.most_wins[0]?.name} />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel share title="Pole times across the eras" subtitle="Fastest qualifying lap each year (timed qualifying data starts in the 1990s). Layout changes show up as jumps.">
          {data.pole_times.length < 2 ? (
            <Empty>Not enough timed qualifying sessions here.</Empty>
          ) : (
            <LineChart ariaLabel="Pole position lap time by year" series={series} height={260} xFormat={(v) => String(v)} yFormat={(v) => lapTime(v, 1)} tooltipX={(v) => String(v)} />
          )}
        </Panel>
        <Panel title="Most successful">
          <ul className="space-y-1.5 text-[13px]">
            {data.most_wins.map((w) => (
              <li key={w.name} className="flex justify-between">
                <span className="text-ink">{w.name}</span>
                <span className="tnum text-ink-2">{w.wins}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            <ul className="space-y-1.5 text-[13px]">
              {data.most_team_wins.map((w) => (
                <li key={w.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink">
                    <span className="h-3.5 w-1 rounded-full" style={{ background: teamColor(w.name) }} />
                    {w.name}
                  </span>
                  <span className="tnum text-ink-2">{w.wins}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
      <Panel title="Every winner" flush bodyClassName="pb-2">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-3 uppercase">
                <th className="py-2 pl-5 font-medium">Year</th>
                <th className="py-2 font-medium">Winner</th>
                <th className="py-2 font-medium">Team</th>
                <th className="py-2 text-right font-medium">Grid</th>
                <th className="py-2 pr-5 pl-6 font-medium">Pole</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={`${r.season}-${r.round}`} className="border-b border-line/60">
                  <td className="tnum py-1.5 pl-5 font-medium text-ink">{r.season}</td>
                  <td className="py-1.5 text-ink">{r.winner}</td>
                  <td className="py-1.5 text-ink-2">{r.team}</td>
                  <td className="tnum py-1.5 text-right text-ink-2">{r.grid ?? "—"}</td>
                  <td className="py-1.5 pr-5 pl-6 text-ink-2">
                    {r.pole ?? "—"} {r.pole_time ? <span className="tnum text-ink-3">· {lapTime(r.pole_time)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
