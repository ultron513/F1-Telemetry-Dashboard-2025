export interface Season {
  season: number;
}

export interface Race {
  round: number;
  event_name: string;
  country: string;
  location: string;
  date: string;
}

export interface Session {
  session_name: string;
  session_type: string;
  date: string;
}