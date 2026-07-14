import { api } from "./api";

export const analyticsService = {
  async getDriverStandings(eventName: string) {
    const response = await api.get("/driver-standings/", {
      params: {
        event_name: eventName,
      },
    });

    return response.data;
  },

  async getConstructorStandings(eventName: string) {
    const response = await api.get("/constructor-standings/", {
      params: {
        event_name: eventName,
      },
    });

    return response.data;
  },

  async getSessionResults(
    eventName: string,
    sessionName: string
  ) {
    const response = await api.get("/session-results/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
      },
    });

    return response.data;
  },

  async getTyreStrategy(eventName: string) {
    const response = await api.get("/tyre-strategy/", {
      params: {
        event_name: eventName,
      },
    });

    return response.data;
  },

  async getPitStops(eventName: string) {
    const response = await api.get("/pit-stops/", {
      params: {
        event_name: eventName,
      },
    });

    return response.data;
  },
};