"use client";

import { useQuery } from "@tanstack/react-query";
import { driverService } from "@/services/driverService";

export function useTeams(
  eventName: string,
  sessionName: string
) {
  return useQuery({
    queryKey: ["teams", eventName, sessionName],
    queryFn: () =>
      driverService.getTeams(
        eventName,
        sessionName
      ),
    enabled: !!eventName && !!sessionName,
  });
}