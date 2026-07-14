import { api } from "./api";

export const weatherService = {
  async getWeather(
    eventName: string,
    sessionName: string
  ) {
    const response = await api.get("/weather/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
      },
    });

    return response.data;
  },

  async getWeatherHistory(
    eventName: string,
    sessionName: string
  ) {
    const response = await api.get("/weather-history/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
      },
    });

    return response.data;
  },
};