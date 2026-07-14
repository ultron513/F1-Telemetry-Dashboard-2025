"use client";

import { useQuery } from "@tanstack/react-query";
import { weatherService } from "@/services/weatherService";

export function useWeather(
  eventName: string,
  sessionName: string
) {
  return useQuery({
    queryKey: [
      "weather",
      eventName,
      sessionName,
    ],
    queryFn: () =>
      weatherService.getWeather(
        eventName,
        sessionName
      ),
    enabled:
      !!eventName &&
      !!sessionName,
  });
}

export function useWeatherHistory(
  eventName: string,
  sessionName: string
) {
  return useQuery({
    queryKey: [
      "weather-history",
      eventName,
      sessionName,
    ],
    queryFn: () =>
      weatherService.getWeatherHistory(
        eventName,
        sessionName
      ),
    enabled:
      !!eventName &&
      !!sessionName,
  });
}