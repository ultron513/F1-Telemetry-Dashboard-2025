import { useQuery } from "@tanstack/react-query";
import { constructorService } from "../services/constructorService";

export default function useConstructorStandings() {
  return useQuery({
    queryKey: ["constructor-standings"],
    queryFn:
      constructorService.getConstructorStandings,
  });
}