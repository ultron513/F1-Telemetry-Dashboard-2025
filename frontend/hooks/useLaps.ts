"use client";

import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

export function useLaps(
  event: string,
  session: string,
  driver: string
) {
  return useQuery({
    queryKey: [
      "available-laps",
      event,
      session,
      driver,
    ],
    queryFn: () =>
      telemetryService.getAvailableLaps(
        event,
        session,
        driver
      ),
    enabled:
      !!event &&
      !!session &&
      !!driver,
  });
}