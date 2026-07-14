import { useQuery } from "@tanstack/react-query";
import { standingsService } from "../services/standingsService";

export default function useDriverStandings() {
  return useQuery({
    queryKey: ["driver-standings"],
    queryFn: standingsService.getDriverStandings,
  });
}