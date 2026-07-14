import { useQuery } from "@tanstack/react-query";
import { performanceScoreService } from "../services/performanceScoreService";

interface Params {
  event: string;
  session: string;
  driver1: string;
  driver2: string;
  lap: number;
}

export default function useDriverPerformanceScore({
  event,
  session,
  driver1,
  driver2,
  lap,
}: Params) {
  return useQuery({
    queryKey: [
      "driver-performance-score",
      event,
      session,
      driver1,
      driver2,
      lap,
    ],

    queryFn: () =>
      performanceScoreService.getDriverPerformanceScore(
        event,
        session,
        driver1,
        driver2,
        lap
      ),

    enabled:
      !!event &&
      !!session &&
      !!driver1 &&
      !!driver2 &&
      lap > 0,
  });
}