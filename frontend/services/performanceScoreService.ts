import { api } from "./api";

export const performanceScoreService = {
  async getDriverPerformanceScore(
    eventName: string,
    sessionName: string,
    driver1: string,
    driver2: string,
    lapNumber: number
  ) {
    const response = await api.get(
      "/driver-performance-score",
      {
        params: {
          event_name: eventName,
          session_name: sessionName,
          driver1,
          driver2,
          lap_number: lapNumber,
        },
      }
    );

    return response.data;
  },
};