"use client";

import { useQuery } from "@tanstack/react-query";
import { seasonService } from "@/services/seasonService";

export function useSessions(eventName: string) {
  return useQuery({
    queryKey: ["sessions", eventName],
    queryFn: () => seasonService.getSessions(eventName),
    enabled: !!eventName,
  });
}