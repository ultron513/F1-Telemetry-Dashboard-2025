"use client";

import { useWeather } from "./useWeather";

export function useDashboardWeather(
  event: string,
  session: string
) {
  return useWeather(event, session);
}