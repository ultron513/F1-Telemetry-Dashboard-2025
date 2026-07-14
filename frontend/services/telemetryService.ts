import { api } from "./api";

export const telemetryService = {
  async getTelemetry(
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) {
    const response = await api.get("/telemetry/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
        driver,
        lap_number: lapNumber,
      },
    });

    return response.data;
  },

  async getTrackMap(
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) {
    const response = await api.get("/track-map/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
        driver,
        lap_number: lapNumber,
      },
    });

    return response.data;
  },

  async getLapSummary(
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) {
    const response = await api.get("/lap-summary/", {
      params: {
        event_name: eventName,
        session_name: sessionName,
        driver,
        lap_number: lapNumber,
      },
    });

    return response.data;
  },

  async getAvailableLaps(
    eventName: string,
    sessionName: string,
    driver: string
  ) {
    const response = await api.get(
      "/laps/available-laps/",
      {
        params: {
          event_name: eventName,
          session_name: sessionName,
          driver,
        },
      }
    );

    return response.data;
  },

  async getDriverCarData(
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) {
    const response = await api.get(
      "/driver-car-data/",
      {
        params: {
          event_name: eventName,
          session_name: sessionName,
          driver,
          lap_number: lapNumber,
        },
      }
    );

    return response.data;
  },

  async getLapDelta(
    eventName: string,
    sessionName: string,
    driver1: string,
    driver2: string,
    lapNumber: number
  ) {
    const response = await api.get("/lap-delta", {
      params: {
        event_name: eventName,
        session_name: sessionName,
        driver1,
        driver2,
        lap_number: lapNumber,
      },
    });

    return response.data;
  },
};