"use client";

import { DriverAvatar } from "@/components/f1/driver-avatar";
import { TeamStripe, Tyre } from "@/components/f1/bits";
import { Picker, type PickerItem } from "@/components/ui/picker";
import { useLapTable, useSeasons } from "@/lib/api/queries";
import type { SessionCode } from "@/lib/api/types";
import { SESSION_LABEL, TIMING } from "@/lib/f1";
import { countryFlagEmoji, lapTime, shortDate } from "@/lib/format";
import { STATIC_MODE } from "@/lib/api/static";
import { eventOpenable, sessionOpenable, useSelection } from "@/state/selection";

export function SeasonPicker({ className }: { className?: string }) {
  const seasons = useSeasons();
  const { season, set } = useSelection();
  const items: PickerItem<string>[] = (seasons.data?.seasons ?? []).map((s) => ({
    value: String(s),
    label: <span className="tnum">{s}</span>,
  }));
  return (
    <Picker
      label="Season"
      caption="Season"
      value={season ? String(season) : null}
      items={items.slice().reverse()}
      onChange={(v) => set({ season: Number(v) })}
      display={<span className="tnum">{season ?? "—"}</span>}
      className={className}
      contentClassName="min-w-40"
    />
  );
}

export function EventPicker({ className }: { className?: string }) {
  const { events, event, set } = useSelection();
  const items: PickerItem<string>[] = events.map((e) => ({
    value: String(e.round),
    search: `${e.round} ${e.name} ${e.country} ${e.location}`,
    disabled: !eventOpenable(e),
    group: e.status === "upcoming" ? "Upcoming" : eventOpenable(e) ? "Completed" : "Not published yet",
    label: (
      <>
        <span className="tnum w-6 shrink-0 text-xs text-ink-3">R{e.round}</span>
        <span aria-hidden>{countryFlagEmoji(e.country)}</span>
        <span className="truncate">{e.name.replace(" Grand Prix", " GP")}</span>
        {e.status === "live" && <span className="ml-1 size-1.5 animate-pulse-dot rounded-full bg-bad" aria-label="live" />}
      </>
    ),
    hint: shortDate(e.date),
  }));
  return (
    <Picker
      label="Grand Prix"
      caption={event ? `Round ${event.round} · ${event.location}` : "Grand Prix"}
      value={event ? String(event.round) : null}
      items={items}
      onChange={(v) => set({ round: Number(v) })}
      searchable
      placeholder="Search races"
      display={
        <>
          <span aria-hidden>{event ? countryFlagEmoji(event.country) : ""}</span>
          <span className="truncate">{event?.name ?? "Select race"}</span>
        </>
      }
      className={className}
      contentClassName="min-w-80"
    />
  );
}

export function SessionPicker({ className }: { className?: string }) {
  const { event, session, set } = useSelection();
  const items: PickerItem<SessionCode>[] = (event?.sessions ?? []).map((s) => ({
    value: s.code,
    disabled: !sessionOpenable(s),
    label: <span>{s.name}</span>,
    hint: s.code,
  }));
  return (
    <Picker
      label="Session"
      caption="Session"
      value={session}
      items={items}
      onChange={(v) => set({ session: v })}
      display={<span className="truncate">{session ? SESSION_LABEL[session] : "—"}</span>}
      className={className}
      contentClassName="min-w-52"
    />
  );
}

export function DriverPicker({
  value,
  onChange,
  caption = "Driver",
  allowNone,
  exclude,
  className,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  caption?: string;
  allowNone?: boolean;
  exclude?: string | null;
  className?: string;
}) {
  const { drivers, summary } = useSelection();
  const order = new Map(summary?.results.map((r, i) => [r.code, i]) ?? []);
  const sorted = [...drivers].sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99));
  const items: PickerItem<string>[] = [
    ...(allowNone ? [{ value: "__none", label: <span className="text-ink-3">No comparison</span>, search: "none" }] : []),
    ...sorted.map((d) => ({
      value: d.code,
      disabled: d.code === exclude,
      search: `${d.code} ${d.full_name} ${d.team} ${d.number}`,
      label: (
        <>
          <span className="tnum w-5 shrink-0 text-right text-xs text-ink-3">{(order.get(d.code) ?? 0) + 1}</span>
          <TeamStripe team={d.team} color={d.team_color} />
          <span className="w-9 shrink-0 font-semibold">{d.code}</span>
          <span className="truncate text-ink-2">{d.full_name}</span>
        </>
      ),
      hint: d.number,
    })),
  ];
  const current = drivers.find((d) => d.code === value);
  return (
    <Picker
      label={caption}
      caption={caption}
      value={value ?? (allowNone ? "__none" : null)}
      items={items}
      onChange={(v) => onChange(v === "__none" ? null : v)}
      searchable
      placeholder="Search drivers"
      display={
        current ? (
          <>
            <DriverAvatar code={current.code} number={current.number} team={current.team} size="xs" />
            <span>{current.code}</span>
            <span className="truncate font-normal text-ink-3">{current.last_name}</span>
          </>
        ) : (
          <span className="text-ink-3">{allowNone ? "None" : "Select"}</span>
        )
      }
      className={className}
      contentClassName="min-w-80"
    />
  );
}

export function LapPicker({
  driver,
  value,
  onChange,
  caption = "Lap",
  className,
}: {
  driver: string | null;
  value: string;
  onChange: (lap: string) => void;
  caption?: string;
  className?: string;
}) {
  const { key } = useSelection();
  const table = useLapTable(key, driver);
  const laps = table.data?.laps ?? [];
  const best = table.data?.personal_best.lap;
  const items: PickerItem<string>[] = [
    {
      value: "fastest",
      label: <span className="font-semibold">Fastest lap</span>,
      hint: <span className="tnum">{lapTime(best)}</span>,
      search: "fastest best",
    },
    ...(STATIC_MODE
      ? [
          {
            value: "__note",
            disabled: true,
            label: <span className="text-xs text-ink-3">This deployment publishes each driver&rsquo;s fastest lap</span>,
          },
        ]
      : []),
    ...laps
      .filter((l) => l.lap != null && !STATIC_MODE)
      .map((l) => ({
        value: String(l.lap),
        search: `lap ${l.lap}`,
        label: (
          <>
            <span className="tnum w-8 shrink-0 text-xs text-ink-3">L{l.lap}</span>
            <Tyre compound={l.compound} size={15} />
            <span
              className="tnum"
              style={{ color: l.grade ? TIMING[l.grade] : "var(--ink-2)", textDecoration: l.deleted ? "line-through" : undefined }}
            >
              {lapTime(l.time)}
            </span>
            {(l.pit_in || l.pit_out) && <span className="text-[11px] text-ink-3">{l.pit_in ? "In lap" : "Out lap"}</span>}
          </>
        ),
      })),
  ];
  const selected = laps.find((l) => String(l.lap) === value);
  return (
    <Picker
      label={caption}
      caption={caption}
      value={value}
      items={items}
      onChange={onChange}
      searchable
      placeholder="Lap number"
      disabled={!driver}
      display={
        value === "fastest" ? (
          <span>Fastest</span>
        ) : (
          <>
            <span className="tnum">L{value}</span>
            {selected && <span className="tnum font-normal text-ink-3">{lapTime(selected.time)}</span>}
          </>
        )
      }
      className={className}
      contentClassName="min-w-64"
    />
  );
}
