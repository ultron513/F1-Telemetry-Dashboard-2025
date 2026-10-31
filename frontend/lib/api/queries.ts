"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import type {
  CircuitResponse,
  CompareResponse,
  DegradationResponse,
  EventsResponse,
  FieldPaceResponse,
  HealthResponse,
  LapTableResponse,
  RaceControlResponse,
  RaceTraceResponse,
  RatingsResponse,
  RecommendationResponse,
  ReplayResponse,
  SeasonsResponse,
  SessionCode,
  SessionSummary,
  StandingsResponse,
  StrategyResponse,
  TelemetryResponse,
  WeatherResponse,
} from "./types";

export interface SessionKey {
  season: number;
  round: number;
  session: SessionCode;
}

const HOUR = 60 * 60 * 1000;

function sessionPath(k: SessionKey, leaf: string) {
  return `/sessions/${k.season}/${k.round}/${k.session}/${leaf}`;
}

function keyParts(k: SessionKey | null) {
  return k ? [k.season, k.round, k.session] : ["none"];
}

export function useSeasons() {
  return useQuery({
    queryKey: ["seasons"],
    queryFn: ({ signal }) => apiGet<SeasonsResponse>("/seasons", undefined, signal),
    staleTime: 24 * HOUR,
  });
}

export function useEvents(season: number | null) {
  return useQuery({
    queryKey: ["events", season],
    queryFn: ({ signal }) => apiGet<EventsResponse>(`/seasons/${season}/events`, undefined, signal),
    enabled: season != null,
    staleTime: HOUR,
  });
}

export function useStandings(season: number | null, round?: number | null) {
  return useQuery({
    queryKey: ["standings", season, round ?? "latest"],
    queryFn: ({ signal }) =>
      apiGet<StandingsResponse>(`/seasons/${season}/standings`, { round: round ?? undefined }, signal),
    enabled: season != null,
    staleTime: HOUR,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => apiGet<HealthResponse>("/health", undefined, signal),
    refetchInterval: 60_000,
    retry: 0,
  });
}

function useSessionQuery<T>(
  k: SessionKey | null,
  leaf: string,
  params?: Record<string, string | number | undefined>,
  enabled = true,
) {
  return useQuery({
    queryKey: ["session", ...keyParts(k), leaf, params ?? {}],
    queryFn: ({ signal }) => apiGet<T>(sessionPath(k as SessionKey, leaf), params, signal),
    enabled: !!k && enabled,
    staleTime: 6 * HOUR,
    placeholderData: keepPreviousData,
  });
}

export const useSummary = (k: SessionKey | null) => useSessionQuery<SessionSummary>(k, "summary");
export const useFieldPace = (k: SessionKey | null) => useSessionQuery<FieldPaceResponse>(k, "pace");
export const useCircuit = (k: SessionKey | null) => useSessionQuery<CircuitResponse>(k, "circuit");
export const useStrategy = (k: SessionKey | null) => useSessionQuery<StrategyResponse>(k, "strategy");
export const useRaceTrace = (k: SessionKey | null) => useSessionQuery<RaceTraceResponse>(k, "race-trace");
export const useRaceControl = (k: SessionKey | null) =>
  useSessionQuery<RaceControlResponse>(k, "race-control");
export const useWeather = (k: SessionKey | null) => useSessionQuery<WeatherResponse>(k, "weather");
export const useRatings = (k: SessionKey | null) => useSessionQuery<RatingsResponse>(k, "ratings");

export const useLapTable = (k: SessionKey | null, driver: string | null) =>
  useSessionQuery<LapTableResponse>(k, "laps", { driver: driver ?? undefined }, !!driver);

export const useTelemetry = (k: SessionKey | null, driver: string | null, lap: string) =>
  useSessionQuery<TelemetryResponse>(k, "telemetry", { driver: driver ?? undefined, lap }, !!driver);

export const useCompare = (
  k: SessionKey | null,
  a: string | null,
  lapA: string,
  b: string | null,
  lapB: string,
) =>
  useSessionQuery<CompareResponse>(
    k,
    "compare",
    { driver_a: a ?? undefined, lap_a: lapA, driver_b: b ?? undefined, lap_b: lapB },
    !!a && !!b && a !== b,
  );

export const useDegradation = (k: SessionKey | null, driver: string | null) =>
  useSessionQuery<DegradationResponse>(k, "degradation", { driver: driver ?? undefined }, !!driver);

export const useRecommendation = (k: SessionKey | null, driver: string | null) =>
  useSessionQuery<RecommendationResponse>(k, "recommendation", { driver: driver ?? undefined }, !!driver);

export const useReplay = (k: SessionKey | null, enabled = true) =>
  useSessionQuery<ReplayResponse>(k, "replay", { step: 1 }, enabled);
