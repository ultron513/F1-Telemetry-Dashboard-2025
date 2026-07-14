export interface DriverStanding {
  position: number;
  driver: string;
  team: string;
  points: number;
  wins: number;
}

export interface ConstructorStanding {
  position: number;
  team: string;
  points: number;
  wins: number;
}

export interface SessionResult {
  position: number;
  driver: string;
  team: string;
  time: string;
  status: string;
  points: number;
}

export interface TyreStint {
  driver: string;
  stint: number;
  compound: string;
  laps: number;
  fresh_tyre: boolean;
}

export interface PitStop {
  driver: string;
  lap: number;
  stint: number;
}