import { api } from "./api";

export const seasonService = {
  async getSeasons() {
    const response = await api.get("/seasons/");
    return response.data;
  },

  async getRaces() {
    const response = await api.get("/races/");
    return response.data;
  },

  async getSessions(eventName: string) {
    const response = await api.get("/sessions/", {
      params: {
        event_name: eventName,
      },
    });

    return response.data;
  },
};