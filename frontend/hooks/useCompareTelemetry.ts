import { useQuery } from "@tanstack/react-query";
import { telemetryService } from "@/services/telemetryService";

interface Params {
  event: string;
  session: string;
  driver: string;
  lap: number;
}

export default function useCompareTelemetry({
  event,
  session,
  driver,
  lap,
}: Params) {
  return useQuery({
    queryKey: [
      "compare-telemetry",
      event,
      session,
      driver,
      lap,
    ],

    queryFn: () =>
      telemetryService.getDriverCarData(
        event,
        session,
        driver,
        lap
      ),

    enabled:
      !!event &&
      !!session &&
      !!driver &&
      lap > 0,
  });
}