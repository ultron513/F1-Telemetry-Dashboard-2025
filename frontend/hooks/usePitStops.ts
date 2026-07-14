"use client";

import { useQuery } from "@tanstack/react-query";
import { getPitStops } from "@/services/pitStopsService";

export function usePitStops(
  eventName: string,
  sessionName: string,
  driver: string
) {
  return useQuery({
    queryKey: ["pit-stops", eventName, sessionName, driver],
    queryFn: () =>
      getPitStops(eventName, sessionName, driver),
    enabled:
      !!eventName &&
      !!sessionName &&
      !!driver,
  });
}