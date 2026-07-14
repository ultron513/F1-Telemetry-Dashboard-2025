"use client";

import { useQuery } from "@tanstack/react-query";
import { driverService } from "@/services/driverService";

export function useDrivers(
  eventName: string,
  sessionName: string
) {
  return useQuery({
    queryKey: ["drivers", eventName, sessionName],
    queryFn: () =>
      driverService.getDrivers(
        eventName,
        sessionName
      ),
    enabled: !!eventName && !!sessionName,
  });
}