"use client";

import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

export function useDriverCarData(
  event: string,
  session: string,
  driver: string,
  lap: number
) {
  return useQuery({
    queryKey: [
      "driver-car-data",
      event,
      session,
      driver,
      lap,
    ],
    queryFn: () =>
      telemetryService.getDriverCarData(
        event,
        session,
        driver,
        lap
      ),
    enabled:
      !!event &&
      !!session &&
      !!driver &&
      lap > 0,
  });
}