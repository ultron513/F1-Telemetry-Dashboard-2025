"use client";

import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

export function useTrackMap(
  eventName: string,
  sessionName: string,
  driver: string,
  lapNumber: number
) {
  return useQuery({
    queryKey: [
      "track-map",
      eventName,
      sessionName,
      driver,
      lapNumber,
    ],
    queryFn: () =>
      telemetryService.getTrackMap(
        eventName,
        sessionName,
        driver,
        lapNumber
      ),
    enabled:
      !!eventName &&
      !!sessionName &&
      !!driver &&
      lapNumber > 0,
  });
}