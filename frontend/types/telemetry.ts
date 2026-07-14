export interface TelemetryPoint {
  distance: number;
  speed: number;
  throttle: number;
  brake: boolean;
  rpm: number;
  gear: number;
  drs: number;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface LapSummary {
  season: number;
  event_name: string;
  session_name: string;
  driver: string;
  lap_number: number;

  lap_time_seconds: number;
  max_speed: number;
  average_speed: number;
  max_rpm: number;
  average_throttle: number;
  brake_percentage: number;
  drs_percentage: number;
  telemetry_samples: number;
}