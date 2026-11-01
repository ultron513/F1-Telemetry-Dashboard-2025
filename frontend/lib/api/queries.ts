"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import type {
  JobInfo,
  QueueStats,
  StatusResponse,
  CareerResponse,
  ChampionsResponse,
  CircuitHistoryResponse,
  HistoryCircuit,
  HistoryDriver,
  Circuit3DResponse,
  OnboardResponse,
  CarsResponse,
  IdealLapResponse,
  StyleResponse,
  TeammateBattleResponse,
  TyreManagementResponse,
  CircuitResponse,
  CompareResponse,
  DegradationResponse,
  EventsResponse,
  FieldPaceResponse,
  HealthResponse,
  LapTableResponse,
  LiveStatus,
  OptimiseResponse,
  RaceControlResponse,
  RaceTraceResponse,
  RatingsResponse,
  RecommendationResponse,
  ReplayResponse,
  SeasonsResponse,
  SessionCode,
  SessionSummary,
  SimulationResponse,
  SimulatorModelResponse,
  StandingsResponse,
  StrategyResponse,
  TelemetryResponse,
  UndercutResponse,
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

// --- Strategy simulator ---------------------------------------------------

export const useSimulatorModel = (k: SessionKey | null, driver: string | null, enabled = true) =>
  useSessionQuery<SimulatorModelResponse>(k, "simulator/model", { driver: driver ?? undefined }, enabled);

export const useSimulation = (
  k: SessionKey | null,
  driver: string | null,
  plan: string | null,
  sc: number,
  vsc: number,
) =>
  useSessionQuery<SimulationResponse>(
    k,
    "simulator/simulate",
    { driver: driver ?? undefined, plan: plan ?? undefined, sc, vsc },
    !!driver && !!plan,
  );

export const useOptimise = (k: SessionKey | null, driver: string | null, conditions: "green" | "hindsight") =>
  useSessionQuery<OptimiseResponse>(k, "simulator/optimise", { driver: driver ?? undefined, conditions }, !!driver);

export const useUndercut = (
  k: SessionKey | null,
  attacker: string | null,
  defender: string | null,
  lap: number | null,
) =>
  useSessionQuery<UndercutResponse>(
    k,
    "simulator/undercut",
    { attacker: attacker ?? undefined, defender: defender ?? undefined, lap: lap ?? undefined },
    !!attacker && !!defender && attacker !== defender && lap != null,
  );

export function useLiveStatus() {
  return useQuery({
    queryKey: ["live-status"],
    queryFn: ({ signal }) => apiGet<LiveStatus>("/live/status", undefined, signal),
    refetchInterval: 60_000,
  });
}

// --- Driver & car analysis ----------------------------------------------------

export const useStyle = (k: SessionKey | null, drivers: string[]) =>
  useSessionQuery<StyleResponse>(k, "analysis/style", { drivers: drivers.join(",") || undefined }, drivers.length > 0);

export const useIdealLap = (k: SessionKey | null, driver: string | null) =>
  useSessionQuery<IdealLapResponse>(k, "analysis/ideal-lap", { driver: driver ?? undefined }, !!driver);

export const useCars = (k: SessionKey | null) => useSessionQuery<CarsResponse>(k, "analysis/cars");

export const useTyreManagement = (k: SessionKey | null, enabled: boolean) =>
  useSessionQuery<TyreManagementResponse>(k, "analysis/tyre-management", undefined, enabled);

export function useTeammates(season: number | null) {
  return useQuery({
    queryKey: ["teammates", season],
    queryFn: ({ signal }) => apiGet<TeammateBattleResponse>(`/seasons/${season}/teammates`, undefined, signal),
    enabled: season != null,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });
}

// --- Visualisation ---------------------------------------------------------------

export const useCircuit3D = (k: SessionKey | null, enabled: boolean) =>
  useSessionQuery<Circuit3DResponse>(k, "circuit/3d", undefined, enabled);

export const useOnboard = (k: SessionKey | null, driver: string | null) =>
  useSessionQuery<OnboardResponse>(k, "replay/onboard", { driver: driver ?? undefined, step: 0.5 }, !!driver);

// --- History ---------------------------------------------------------------------

const DAY = 24 * HOUR;

export function useChampions() {
  return useQuery({
    queryKey: ["history", "champions"],
    queryFn: ({ signal }) => apiGet<ChampionsResponse>("/history/champions", undefined, signal),
    staleTime: DAY,
  });
}

export function useHistoryDrivers(search: string) {
  return useQuery({
    queryKey: ["history", "drivers", search],
    queryFn: ({ signal }) => apiGet<{ drivers: HistoryDriver[] }>("/history/drivers", { search }, signal),
    staleTime: DAY,
    placeholderData: keepPreviousData,
  });
}

export function useCareer(id: string | null) {
  return useQuery({
    queryKey: ["history", "driver", id],
    queryFn: ({ signal }) => apiGet<CareerResponse>(`/history/drivers/${id}`, undefined, signal),
    enabled: !!id,
    staleTime: DAY,
  });
}

export function useHistoryCircuits() {
  return useQuery({
    queryKey: ["history", "circuits"],
    queryFn: ({ signal }) => apiGet<{ circuits: HistoryCircuit[] }>("/history/circuits", undefined, signal),
    staleTime: DAY,
  });
}

export function useCircuitHistory(id: string | null) {
  return useQuery({
    queryKey: ["history", "circuit", id],
    queryFn: ({ signal }) => apiGet<CircuitHistoryResponse>(`/history/circuits/${id}`, undefined, signal),
    enabled: !!id,
    staleTime: DAY,
  });
}

// --- Operations --------------------------------------------------------------------

export function useStatus() {
  return useQuery({
    queryKey: ["ops", "status"],
    queryFn: ({ signal }) => apiGet<StatusResponse>("/status", undefined, signal),
    refetchInterval: 10_000,
    retry: 0,
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ["ops", "jobs"],
    queryFn: ({ signal }) => apiGet<QueueStats & { jobs: JobInfo[] }>("/jobs", { limit: 20 }, signal),
    refetchInterval: 5_000,
    retry: 0,
  });
}
