export function isValidLapNumber(
  lapNumber: number
): boolean {
  return Number.isInteger(lapNumber) && lapNumber > 0;
}

export function isValidDriver(
  driver: string
): boolean {
  return driver.trim().length > 0;
}

export function isValidEvent(
  eventName: string
): boolean {
  return eventName.trim().length > 0;
}

export function isValidSession(
  sessionName: string
): boolean {
  return sessionName.trim().length > 0;
}

export function canFetchTelemetry(
  eventName: string,
  sessionName: string,
  driver: string,
  lapNumber: number
): boolean {
  return (
    isValidEvent(eventName) &&
    isValidSession(sessionName) &&
    isValidDriver(driver) &&
    isValidLapNumber(lapNumber)
  );
}