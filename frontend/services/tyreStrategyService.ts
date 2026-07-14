const API_BASE = "http://127.0.0.1:8000";

export interface TyreStint {
  driver: string;
  stint: number;
  compound: string;
  laps: number;
  fresh_tyre: boolean;
}

export interface TyreStrategyResponse {
  season: number;
  event_name: string;
  stints: TyreStint[];
}

export async function getTyreStrategy(
  event_name: string,
  session_name: string,
  driver: string
): Promise<TyreStrategyResponse> {

  const response = await fetch(
    `${API_BASE}/api/v1/tyre-strategy/?event_name=${encodeURIComponent(
      event_name
    )}&session_name=${encodeURIComponent(
      session_name
    )}&driver=${encodeURIComponent(driver)}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tyre strategy.");
  }

  return response.json();
}