"use client";

import { useQuery } from "@tanstack/react-query";
import { seasonService } from "@/services/seasonService";

export function useSeasons() {
  return useQuery({
    queryKey: ["seasons"],
    queryFn: () => seasonService.getSeasons(),
  });
}