export const queryKeys = {
  seasons: ["seasons"] as const,

  races: ["races"] as const,

  sessions: (eventName: string) =>
    ["sessions", eventName] as const,

  drivers: (
    eventName: string,
    sessionName: string
  ) =>
    ["drivers", eventName, sessionName] as const,

  teams: (
    eventName: string,
    sessionName: string
  ) =>
    ["teams", eventName, sessionName] as const,

  telemetry: (
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) =>
    [
      "telemetry",
      eventName,
      sessionName,
      driver,
      lapNumber,
    ] as const,

  trackMap: (
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) =>
    [
      "track-map",
      eventName,
      sessionName,
      driver,
      lapNumber,
    ] as const,

  lapSummary: (
    eventName: string,
    sessionName: string,
    driver: string,
    lapNumber: number
  ) =>
    [
      "lap-summary",
      eventName,
      sessionName,
      driver,
      lapNumber,
    ] as const,
};