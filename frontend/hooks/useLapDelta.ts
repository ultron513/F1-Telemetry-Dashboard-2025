"use client";

import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

interface Params {
  event: string;
  session: string;
  driver1: string;
  driver2: string;
  lap: number;
}

export default function useLapDelta({
  event,
  session,
  driver1,
  driver2,
  lap,
}: Params) {
  return useQuery({
    queryKey: [
      "lap-delta",
      event,
      session,
      driver1,
      driver2,
      lap,
    ],

    queryFn: () =>
      telemetryService.getLapDelta(
        event,
        session,
        driver1,
        driver2,
        lap
      ),

    enabled:
      !!event &&
      !!session &&
      !!driver1 &&
      !!driver2 &&
      lap > 0,
  });
}