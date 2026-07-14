"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getRaceControl,
  RaceControlMessage,
} from "@/services/raceControlService";

export function useRaceControl(
  event_name: string,
  session_name: string
) {
  return useQuery<RaceControlMessage[]>({
    queryKey: [
      "race-control",
      event_name,
      session_name,
    ],
    queryFn: () =>
      getRaceControl(
        event_name,
        session_name
      ),
    enabled: !!event_name && !!session_name,
  });
}