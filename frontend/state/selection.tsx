"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import { useEvents, useSeasons, useSummary, type SessionKey } from "@/lib/api/queries";
import type { DriverInfo, Event, SessionCode, SessionSummary } from "@/lib/api/types";

/**
 * The session the whole dashboard is looking at, stored in the URL
 * (?season=2025&round=3&session=R&driver=VER&vs=NOR&lap=fastest&vslap=fastest)
 * so every view is shareable. Missing values resolve to sensible defaults
 * (latest completed race, its winner and runner-up) without touching the URL.
 */

export interface SelectionPatch {
  season?: number;
  round?: number;
  session?: SessionCode;
  driver?: string;
  vs?: string | null;
  lap?: string;
  vslap?: string;
}

interface SelectionCtx {
  season: number | null;
  round: number | null;
  session: SessionCode | null;
  driver: string | null;
  vs: string | null;
  lap: string;
  vsLap: string;
  key: SessionKey | null;
  events: Event[];
  event: Event | null;
  summary: SessionSummary | undefined;
  summaryState: ReturnType<typeof useSummary>;
  drivers: DriverInfo[];
  focus: DriverInfo | null;
  rival: DriverInfo | null;
  set: (patch: SelectionPatch) => void;
  queryString: string;
}

const SelectionContext = createContext<SelectionCtx | null>(null);
const STORAGE_KEY = "pitwall.selection.v1";

function pickSession(event: Event | null, wanted: string | null): SessionCode | null {
  if (!event) return null;
  const now = Date.now();
  const past = event.sessions.filter((s) => !s.start_utc || new Date(s.start_utc).getTime() < now);
  if (wanted && event.sessions.some((s) => s.code === wanted)) return wanted as SessionCode;
  const race = past.find((s) => s.code === "R");
  if (race) return "R";
  const last = past[past.length - 1] ?? event.sessions[event.sessions.length - 1];
  return last?.code ?? null;
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const seasons = useSeasons();
  const rawSeason = Number(params.get("season")) || null;
  const season =
    rawSeason && seasons.data?.seasons.includes(rawSeason)
      ? rawSeason
      : seasons.data
        ? seasons.data.default_season
        : rawSeason;

  const eventsQuery = useEvents(season);
  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);
  const rawRound = Number(params.get("round")) || null;
  const event =
    events.find((e) => e.round === rawRound) ??
    eventsQuery.data?.last_completed ??
    events[0] ??
    null;
  const round = event?.round ?? null;
  const session = pickSession(event, params.get("session"));

  const key: SessionKey | null =
    season && round && session ? { season, round, session } : null;
  const summaryState = useSummary(key);
  const summary = summaryState.data;
  const drivers = useMemo(() => summary?.drivers ?? [], [summary]);
  const codes = new Set(drivers.map((d) => d.code));
  const order = summary?.results.map((r) => r.code) ?? [];

  const rawDriver = params.get("driver")?.toUpperCase() ?? null;
  const driver = rawDriver && codes.has(rawDriver) ? rawDriver : (order[0] ?? null);
  const rawVs = params.get("vs");
  const vs =
    rawVs === "none"
      ? null
      : rawVs && codes.has(rawVs.toUpperCase()) && rawVs.toUpperCase() !== driver
        ? rawVs.toUpperCase()
        : (order.find((c) => c !== driver) ?? null);

  const lap = params.get("lap") || "fastest";
  const vsLap = params.get("vslap") || "fastest";

  // Restore the last selection when arriving without query parameters.
  useEffect(() => {
    if (params.toString()) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) router.replace(`${pathname}?${stored}`, { scroll: false });
    } catch {
      /* ignore */
    }
    // Only on first mount of a parameterless URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback(
    (patch: SelectionPatch) => {
      const next = new URLSearchParams(params.toString());
      const write = (k: string, v: string | number | null | undefined) => {
        if (v === undefined) return;
        if (v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      };
      if (patch.season !== undefined) {
        write("season", patch.season);
        ["round", "session", "driver", "vs", "lap", "vslap"].forEach((k) => next.delete(k));
      }
      if (patch.round !== undefined) {
        write("round", patch.round);
        ["session", "lap", "vslap"].forEach((k) => next.delete(k));
      }
      if (patch.session !== undefined) {
        write("session", patch.session);
        ["lap", "vslap"].forEach((k) => next.delete(k));
      }
      if (patch.driver !== undefined) {
        write("driver", patch.driver);
        next.delete("lap");
        if (patch.driver === (next.get("vs") ?? vs)) next.delete("vs");
      }
      if (patch.vs !== undefined) {
        write("vs", patch.vs === null ? "none" : patch.vs);
        next.delete("vslap");
      }
      write("lap", patch.lap);
      write("vslap", patch.vslap);
      const qs = next.toString();
      try {
        window.localStorage.setItem(STORAGE_KEY, qs);
      } catch {
        /* ignore */
      }
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, vs],
  );

  const value = useMemo<SelectionCtx>(() => {
    const focus = drivers.find((d) => d.code === driver) ?? null;
    const rival = drivers.find((d) => d.code === vs) ?? null;
    const qs = new URLSearchParams();
    if (season) qs.set("season", String(season));
    if (round) qs.set("round", String(round));
    if (session) qs.set("session", session);
    if (driver) qs.set("driver", driver);
    if (rawVs === "none") qs.set("vs", "none");
    else if (vs) qs.set("vs", vs);
    return {
      season,
      round,
      session,
      driver,
      vs,
      lap,
      vsLap,
      key,
      events,
      event,
      summary,
      summaryState,
      drivers,
      focus,
      rival,
      set,
      queryString: qs.toString(),
    };
    // key is derived from season/round/session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, round, session, driver, vs, rawVs, lap, vsLap, events, event, summary, summaryState, drivers, set]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside SelectionProvider");
  return ctx;
}
