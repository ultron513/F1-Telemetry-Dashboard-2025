"use client";

import { useDriverCarData } from "./useDriverCarData";

export function useDashboardTelemetry(
  event: string,
  session: string,
  driver: string,
  lap: string
) {
  return useDriverCarData(
    event,
    session,
    driver,
    Number(lap)
  );
}