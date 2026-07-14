"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analyticsService";

export function useDriverStandings(eventName: string) {
  return useQuery({
    queryKey: ["driver-standings", eventName],
    queryFn: () =>
      analyticsService.getDriverStandings(eventName),
    enabled: !!eventName,
  });
}

export function useConstructorStandings(eventName: string) {
  return useQuery({
    queryKey: ["constructor-standings", eventName],
    queryFn: () =>
      analyticsService.getConstructorStandings(eventName),
    enabled: !!eventName,
  });
}

export function useSessionResults(
  eventName: string,
  sessionName: string
) {
  return useQuery({
    queryKey: [
      "session-results",
      eventName,
      sessionName,
    ],
    queryFn: () =>
      analyticsService.getSessionResults(
        eventName,
        sessionName
      ),
    enabled:
      !!eventName &&
      !!sessionName,
  });
}

export function useTyreStrategy(eventName: string) {
  return useQuery({
    queryKey: ["tyre-strategy", eventName],
    queryFn: () =>
      analyticsService.getTyreStrategy(eventName),
    enabled: !!eventName,
  });
}

export function usePitStops(eventName: string) {
  return useQuery({
    queryKey: ["pit-stops", eventName],
    queryFn: () =>
      analyticsService.getPitStops(eventName),
    enabled: !!eventName,
  });
}