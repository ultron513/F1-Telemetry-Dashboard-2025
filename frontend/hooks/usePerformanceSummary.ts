"use client";

import { useQuery } from "@tanstack/react-query";
import { performanceService } from "@/services/performanceService";

interface Params {
  event: string;
  session: string;
  driver1: string;
  driver2: string;
  lap: number;
}

export default function usePerformanceSummary({
  event,
  session,
  driver1,
  driver2,
  lap,
}: Params) {
  return useQuery({
    queryKey: [
      "performance-summary",
      event,
      session,
      driver1,
      driver2,
      lap,
    ],

    queryFn: () =>
      performanceService.getPerformanceSummary(
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