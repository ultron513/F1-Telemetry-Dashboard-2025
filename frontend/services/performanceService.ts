import { api } from "./api";

export const performanceService = {
  async getPerformanceSummary(
    eventName: string,
    sessionName: string,
    driver1: string,
    driver2: string,
    lapNumber: number
  ) {
    const response = await api.get(
      "/performance-summary",
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