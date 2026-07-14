import { api } from "./api";

export const driverService = {
  async getDrivers(
    eventName: string,
    sessionName: string
  ) {
    const response = await api.get("/drivers/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
      },
    });

    return response.data;
  },

  async getTeams(
    eventName: string,
    sessionName: string
  ) {
    const response = await api.get("/teams/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
      },
    });

    return response.data;
  },
};