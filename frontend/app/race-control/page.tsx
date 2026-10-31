"use client";

import { useMemo, useState } from "react";

import { FlagChip } from "@/components/f1/bits";
import { SessionReplay } from "@/components/replay/replay";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Empty, QueryView, Segmented } from "@/components/ui/primitives";
import { useRaceControl } from "@/lib/api/queries";
import type { RaceControlResponse } from "@/lib/api/types";
import { MESSAGE_STYLE, TRACK_STATUS } from "@/lib/f1";
import { cn } from "@/lib/utils";
import { useSelection } from "@/state/selection";

export default function RaceControlPage() {
  return (
    <SessionGate>
      <RaceControl />
    </SessionGate>
  );
}

function RaceControl() {
  const [tab, setTab] = useState<"replay" | "log">("replay");
  return (
    <>
      <PageHeader
        title="Race control"
        description="Replay the session with every car on the map and race control calls arriving as they happened, or read the full log of flags, safety cars and stewards' decisions."
        actions={
          <Segmented
            label="Race control view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "replay", label: "Session replay" },
              { value: "log", label: "Message log" },
            ]}
          />
        }
      />
      {tab === "replay" ? <SessionReplay /> : <Log />}
    </>
  );
}

const GROUPS = ["Flags", "Safety car", "Stewards", "Penalties", "DRS", "Other"] as const;

function Log() {
  const { key } = useSelection();
  const rc = useRaceControl(key);
  return <QueryView query={rc}>{(d) => <LogBody d={d} />}</QueryView>;
}

function LogBody({ d }: { d: RaceControlResponse }) {
  const [groups, setGroups] = useState<Set<string>>(new Set(GROUPS));
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      d.messages.filter(
        (m) => groups.has(MESSAGE_STYLE[m.kind].group) && (!query || `${m.message} ${m.drivers.join(" ")}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [d.messages, groups, query],
  );
  const byGroup = GROUPS.map((g) => ({ g, n: d.messages.filter((m) => MESSAGE_STYLE[m.kind].group === g).length }));
  const totalLaps = d.total_laps ?? Math.max(1, ...d.messages.map((m) => m.lap ?? 0));
  const window = d.session_window;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Panel accent title="Track status" subtitle="Each band is a period under that status, plotted across the session">
          {window.start != null && window.end != null ? (
            <>
              <div className="relative h-9 overflow-hidden rounded-md bg-surface-3">
                {d.track_status
                  .filter((s) => s.end != null && s.start != null && (s.end as number) > (window.start as number))
                  .map((s, i) => {
                    const span = (window.end as number) - (window.start as number);
                    const left = Math.max(0, ((s.start as number) - (window.start as number)) / span);
                    const right = Math.min(1, ((s.end as number) - (window.start as number)) / span);
                    if (right <= left) return null;
                    return (
                      <span
                        key={i}
                        title={`${s.label}${s.start_lap ? `, lap ${s.start_lap}` : ""}`}
                        className="absolute top-0 h-full border-r border-surface"
                        style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%`, background: TRACK_STATUS[s.status]?.color ?? "#555", opacity: s.status === "1" ? 0.35 : 1 }}
                      />
                    );
                  })}
              </div>
              <div className="tnum mt-1.5 flex justify-between text-xs text-ink-3">
                <span>Start</span>
                <span>{totalLaps} laps</span>
                <span>Finish</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                {["2", "4", "6", "5"].map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: TRACK_STATUS[s].color }} />
                    {TRACK_STATUS[s].label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <Empty>No track status data.</Empty>
          )}
        </Panel>

        <Panel
          title="Messages"
          subtitle={`${filtered.length} of ${d.messages.length}`}
          actions={
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by driver or text"
              aria-label="Filter messages"
              className="h-8 w-56 rounded-md border border-line bg-surface-2 px-2.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-team"
            />
          }
          flush
          bodyClassName="px-2 pb-2"
        >
          {filtered.length === 0 ? (
            <Empty>No messages match these filters.</Empty>
          ) : (
            <ol className="scroll-thin max-h-[640px] overflow-y-auto">
              {filtered.map((m, i) => {
                const newLap = i === 0 || filtered[i - 1].lap !== m.lap;
                return (
                  <li key={m.id}>
                    {newLap && (
                      <div className="sticky top-0 z-10 bg-surface px-2 pt-3 pb-1 text-xs font-semibold text-ink-3">
                        {m.lap ? `Lap ${m.lap}` : "Before the start"}
                      </div>
                    )}
                    <div className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-2">
                      <span className="tnum w-16 shrink-0 pt-0.5 text-xs text-ink-3">
                        {m.time_utc ? new Date(m.time_utc).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }) : ""}
                      </span>
                      <FlagChip kind={m.kind} label={m.title} className="mt-0.5 w-32 justify-center" />
                      <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">{m.message}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Filter by type">
          <ul className="space-y-1">
            {byGroup.map(({ g, n }) => {
              const on = groups.has(g);
              return (
                <li key={g}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(g)) next.delete(g);
                        else next.add(g);
                        return next;
                      })
                    }
                    className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors", on ? "bg-surface-3 text-ink" : "text-ink-3 hover:bg-surface-2")}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("size-3 rounded-sm border", on ? "border-team bg-team" : "border-line-strong")} aria-hidden />
                      {g}
                    </span>
                    <span className="tnum text-xs">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="Session in numbers">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            {[
              ["Yellow flags", (d.counts.yellow ?? 0) + (d.counts.double_yellow ?? 0)],
              ["Safety car calls", d.counts.sc ?? 0],
              ["VSC calls", d.counts.vsc ?? 0],
              ["Red flags", d.counts.red ?? 0],
              ["Blue flags", d.counts.blue ?? 0],
              ["Track limits", d.counts.track_limits ?? 0],
              ["Investigations", d.counts.investigation ?? 0],
              ["Penalties", d.counts.penalty ?? 0],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="tnum text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
