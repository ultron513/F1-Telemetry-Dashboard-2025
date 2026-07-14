"use client";

import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

export function useLapSummary(
  eventName: string,
  sessionName: string,
  driver: string,
  lapNumber: number
) {
  return useQuery({
    queryKey: [
      "lap-summary",
      eventName,
      sessionName,
      driver,
      lapNumber,
    ],
    queryFn: () =>
      telemetryService.getLapSummary(
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