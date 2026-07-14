"use client";

import { useLapSummary } from "./useLapSummary";

export function useDashboardLap(
  event: string,
  session: string,
  driver: string,
  lap: number
) {
  return useLapSummary(
    event,
    session,
    driver,
    lap
  );
}