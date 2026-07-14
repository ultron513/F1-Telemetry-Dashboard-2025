"use client";

import { useQuery } from "@tanstack/react-query";
import { getTyreDegradation } from "@/services/tyreDegradationService";

export function useTyreDegradation(
  eventName: string,
  sessionName: string,
  driver: string
) {
  return useQuery({
    queryKey: [
      "tyre-degradation",
      eventName,
      sessionName,
      driver,
    ],
    queryFn: () =>
      getTyreDegradation(
        eventName,
        sessionName,
        driver
      ),
    enabled:
      !!eventName &&
      !!sessionName &&
      !!driver,
  });
}