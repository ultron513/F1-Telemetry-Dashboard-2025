import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

export interface RaceControlMessage {
  time: string;
  category: string;
  message: string;
  status: string;
  flag: string;
  scope: string;
}

export async function getRaceControl(
  event_name: string,
  session_name: string
): Promise<RaceControlMessage[]> {
  const response = await axios.get<RaceControlMessage[]>(
    `${API_URL}/race-control`,
    {
      params: {
        event_name,
        session_name,
      },
    }
  );

  return response.data;
}