export function formatLapTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "--";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
}

export function formatSpeed(speed: number): string {
  if (!speed || Number.isNaN(speed)) return "--";

  return `${speed.toFixed(1)} km/h`;
}

export function formatTemperature(temp: number): string {
  if (!temp || Number.isNaN(temp)) return "--";

  return `${temp.toFixed(1)}°C`;
}

export function formatPercentage(value: number): string {
  if (!value || Number.isNaN(value)) return "--";

  return `${value.toFixed(1)}%`;
}