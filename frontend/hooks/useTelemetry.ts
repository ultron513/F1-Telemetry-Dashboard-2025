"use client";

import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

export function useTelemetry(
  eventName: string,
  sessionName: string,
  driver: string,
  lapNumber: number
) {
  return useQuery({
    queryKey: [
      "telemetry",
      eventName,
      sessionName,
      driver,
      lapNumber,
    ],
    queryFn: () =>
      telemetryService.getTelemetry(
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