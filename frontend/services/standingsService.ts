import { api } from "./api";

export const standingsService = {
  async getDriverStandings() {
    const response = await api.get("/standings/drivers");

    return response.data;
  },
};