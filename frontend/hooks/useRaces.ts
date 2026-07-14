"use client";

import { useQuery } from "@tanstack/react-query";
import { seasonService } from "@/services/seasonService";

export function useRaces() {
  return useQuery({
    queryKey: ["races"],
    queryFn: () => seasonService.getRaces(),
  });
}