const API = "http://127.0.0.1:8000";

export async function getTyreDegradation(
  eventName: string,
  sessionName: string,
  driver: string
) {
  const params = new URLSearchParams({
    event_name: eventName,
    session_name: sessionName,
    driver,
  });

  const response = await fetch(
    `${API}/api/v1/tyre-degradation/?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tyre degradation.");
  }

  return response.json();
}