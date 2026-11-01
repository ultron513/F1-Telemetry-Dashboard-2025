// Types mirroring the FastAPI response schemas (backend/app/schemas).

export type SessionCode = "FP1" | "FP2" | "FP3" | "Q" | "SQ" | "SS" | "S" | "R";
export type SessionKind = "race" | "qualifying" | "practice";
export type Grade = "purple" | "green" | "yellow" | null;

export interface SessionSlot {
  code: SessionCode;
  name: string;
  kind: SessionKind;
  start_utc: string | null;
}

export interface Event {
  round: number;
  name: string;
  official_name: string;
  country: string;
  location: string;
  date: string | null;
  format: string;
  status: "completed" | "live" | "upcoming";
  sessions: SessionSlot[];
}

export interface SeasonsResponse {
  seasons: number[];
  default_season: number;
}

export interface EventsResponse {
  season: number;
  events: Event[];
  next_event: Event | null;
  last_completed: Event | null;
}

export interface DriverInfo {
  code: string;
  number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  broadcast_name: string;
  team: string;
  team_color: string | null;
  country_code: string | null;
  position: number | null;
}

export interface SessionContext {
  season: number;
  round: number;
  session: { code: SessionCode; name: string; kind: SessionKind };
}

export interface ResultRow {
  position: number | null;
  classified_position: string | null;
  code: string;
  number: string;
  full_name: string;
  team: string;
  team_color: string | null;
  grid: number | null;
  status: string | null;
  points: number | null;
  laps: number | null;
  time_text: string | null;
  gap: number | null;
  best_lap: number | null;
  best_lap_number: number | null;
  fastest_lap: boolean;
  q1: number | null;
  q2: number | null;
  q3: number | null;
}

export interface SessionSummary extends SessionContext {
  event: Event;
  drivers: DriverInfo[];
  results: ResultRow[];
  highlights: {
    winner: string | null;
    winner_team: string | null;
    podium: string[];
    fastest_lap: { driver: string; team: string; time: number | null; lap: number | null } | null;
    total_laps: number | null;
    laps_recorded: number;
    timed_laps: number;
    pit_stops: number;
    position_changes: number | null;
    retirements: string[];
    safety_car: number;
    vsc: number;
    red_flag: number;
    yellow: number;
  };
  weather: {
    air_temp: number | null;
    track_temp: number | null;
    track_temp_max: number | null;
    humidity: number | null;
    wind_speed: number | null;
    rainfall: boolean;
  } | null;
}

export interface LapRow {
  lap: number | null;
  time: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  grade: Grade;
  s1_grade: Grade;
  s2_grade: Grade;
  s3_grade: Grade;
  compound: string | null;
  tyre_life: number | null;
  fresh_tyre: boolean;
  stint: number | null;
  position: number | null;
  pit_in: boolean;
  pit_out: boolean;
  track_status: string[];
  deleted: boolean;
  deleted_reason: string | null;
  speed_i1: number | null;
  speed_i2: number | null;
  speed_fl: number | null;
  speed_st: number | null;
  personal_best: boolean;
}

export interface Bests {
  lap: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

export interface LapTableResponse extends SessionContext {
  driver: DriverInfo;
  laps: LapRow[];
  session_best: Bests;
  personal_best: Bests;
  stats: {
    best_lap: number | null;
    theoretical_best: number | null;
    average_clean: number | null;
    median_clean: number | null;
    std_clean: number | null;
    clean_laps: number;
    total_laps: number;
    pit_stops: number;
  };
  stints: {
    stint: number | null;
    compound: string | null;
    start_lap: number | null;
    end_lap: number | null;
    laps: number;
    average: number | null;
    best: number | null;
  }[];
}

export interface DriverPace {
  code: string;
  team: string;
  team_color: string | null;
  laps: { lap: number | null; time: number | null; compound: string | null; tyre_life: number | null }[];
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  mean: number | null;
  std: number | null;
  gap_to_best: number | null;
}

export interface FieldPaceResponse extends SessionContext {
  drivers: DriverPace[];
}

export interface LapMeta {
  lap: number | null;
  time: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  compound: string | null;
  tyre_life: number | null;
  position: number | null;
  speed_trap: number | null;
  deleted: boolean;
}

export interface Channels {
  distance: number[];
  time: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  rpm: number[];
  gear: number[];
  drs: number[];
  x: number[];
  y: number[];
}

export interface TelemetryStats {
  max_speed: number | null;
  min_speed: number | null;
  avg_speed: number | null;
  max_rpm: number | null;
  avg_rpm: number | null;
  full_throttle_pct: number | null;
  braking_pct: number | null;
  coasting_pct: number | null;
  drs_pct: number | null;
  gear_changes: number;
  top_gear: number;
  distance: number | null;
}

export interface BrakingZone {
  start: number;
  end: number;
  entry_speed: number;
  min_speed: number;
  speed_drop: number;
  decel_g: number;
}

export interface CornerSpeed {
  number: number | null;
  letter: string;
  distance: number;
  min_speed: number;
  gear: number;
}

export interface TelemetryResponse extends SessionContext {
  driver: DriverInfo;
  lap: LapMeta;
  sector_marks: number[];
  channels: Channels;
  stats: TelemetryStats;
  braking_zones: BrakingZone[];
  corners: CornerSpeed[];
  insights: { kind: string; title: string; text: string }[];
}

export interface MiniSector {
  index: number;
  start: number;
  end: number;
  time_a: number;
  time_b: number;
  winner: "a" | "b" | "even";
  gain: number;
}

export interface CompareResponse extends SessionContext {
  a: { driver: DriverInfo; lap: LapMeta; stats: TelemetryStats };
  b: { driver: DriverInfo; lap: LapMeta; stats: TelemetryStats };
  distance: number[];
  channels_a: Channels;
  channels_b: Channels;
  delta: number[];
  final_delta: number | null;
  sector_marks: number[];
  sectors: { sector: string; a: number | null; b: number | null; delta: number | null }[];
  minisectors: MiniSector[];
  dominance: { a: number; b: number };
}

export interface Corner {
  number: number | null;
  letter: string;
  x: number | null;
  y: number | null;
  angle: number | null;
  distance: number | null;
}

export interface CircuitResponse extends SessionContext {
  length: number;
  rotation: number;
  corner_source: "official" | "detected";
  reference: { driver: string | null; lap: number | null; time: number | null };
  outline: { x: number[]; y: number[]; distance: number[] };
  corners: Corner[];
  sectors: number[];
  drs_zones: { start: number; end: number }[];
}

export interface Stint {
  stint: number | null;
  compound: string;
  start_lap: number | null;
  end_lap: number | null;
  laps: number;
  start_age: number | null;
  fresh: boolean;
  average: number | null;
  degradation: number | null;
  fuel_corrected_degradation: number | null;
  fit_r2: number | null;
}

export interface PitStop {
  code: string;
  team: string;
  team_color: string | null;
  stop: number;
  lap: number | null;
  pit_lane_time: number | null;
  from_compound: string | null;
  to_compound: string | null;
  under: "SC" | "VSC" | "RED" | null;
}

export interface StrategyResponse extends SessionContext {
  total_laps: number | null;
  stints: { code: string; team: string | null; team_color: string | null; stints: Stint[] }[];
  pit_stops: PitStop[];
  pit_loss: number | null;
  median_pit_lane: number | null;
  fastest_pit_lane: PitStop | null;
  compound_degradation: Record<string, number | null>;
}

export interface RaceTraceResponse extends SessionContext {
  total_laps: number | null;
  drivers: {
    code: string;
    team: string;
    team_color: string | null;
    points: { lap: number; position: number | null; gap: number | null }[];
  }[];
  lap_status: { lap: number; status: string }[];
}

export interface DegradationResponse extends SessionContext {
  driver: DriverInfo;
  fuel_effect_per_lap: number;
  stints: {
    stint: number | null;
    compound: string;
    start_lap: number | null;
    end_lap: number | null;
    laps: { lap: number | null; tyre_life: number | null; time: number | null; fuel_corrected: number | null }[];
    slope: number | null;
    intercept: number | null;
    r2: number | null;
    fuel_corrected_slope: number | null;
    fuel_corrected_intercept: number | null;
    fuel_corrected_r2: number | null;
  }[];
}

export type StintVerdict =
  | "insufficient-data"
  | "no-degradation"
  | "deg-not-limiting"
  | "overextended"
  | "early"
  | "on-target";

export interface RecommendationResponse extends SessionContext {
  driver: DriverInfo;
  pit_loss: number;
  pit_loss_source: "measured" | "estimated";
  risk: "low" | "medium" | "high" | "unknown";
  stints: {
    stint: number | null;
    compound: string;
    laps: number;
    degradation: number | null;
    optimal_length: number | null;
    verdict: StintVerdict;
  }[];
}

export type MessageKind =
  | "red" | "sc" | "vsc" | "yellow" | "double_yellow" | "green" | "clear" | "blue"
  | "chequered" | "black_white" | "black_orange" | "penalty" | "investigation"
  | "track_limits" | "drs" | "weather" | "pit" | "info";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface RaceControlMessage {
  id: number;
  time_utc: string | null;
  session_time: number | null;
  lap: number | null;
  category: string;
  kind: MessageKind;
  severity: Severity;
  title: string;
  message: string;
  flag: string | null;
  status: string | null;
  scope: string | null;
  sector: number | null;
  drivers: string[];
}

export interface TrackStatusSegment {
  status: string;
  label: string;
  start: number | null;
  end: number | null;
  start_lap: number | null;
  end_lap: number | null;
}

export interface RaceControlResponse extends SessionContext {
  messages: RaceControlMessage[];
  counts: Record<string, number>;
  track_status: TrackStatusSegment[];
  session_window: { start: number | null; end: number | null };
  total_laps: number | null;
}

export interface WeatherStat {
  min: number | null;
  max: number | null;
  mean: number | null;
  start: number | null;
  end: number | null;
}

export interface WeatherResponse extends SessionContext {
  series: {
    minute: number[];
    air_temp: (number | null)[];
    track_temp: (number | null)[];
    humidity: (number | null)[];
    pressure: (number | null)[];
    wind_speed: (number | null)[];
    wind_direction: (number | null)[];
    rainfall: boolean[];
  } | null;
  summary: {
    air_temp: WeatherStat;
    track_temp: WeatherStat;
    humidity: WeatherStat;
    pressure: WeatherStat;
    wind_speed: WeatherStat;
    rain_share: number | null;
    samples: number;
  } | null;
  wind_rose: { direction: string; share: number; bands: { from: number; to: number; share: number }[] }[];
  rain_windows: { start: number; end: number }[];
}

export interface RatingsResponse extends SessionContext {
  metrics: { key: string; label: string; higher_is_better: boolean; unit: string; weight: number }[];
  drivers: {
    code: string;
    team: string;
    team_color: string | null;
    overall: number | null;
    rank: number;
    scores: Record<string, number | null>;
    raw: Record<string, number | null>;
  }[];
}

export interface DriverStanding {
  position: number;
  code: string;
  driver_id: string;
  number: string | null;
  full_name: string;
  nationality: string | null;
  team: string | null;
  team_id: string | null;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
}

export interface ConstructorStanding {
  position: number;
  team: string;
  team_id: string | null;
  nationality: string | null;
  points: number;
  wins: number;
}

export interface StandingsResponse {
  season: number;
  source: "jolpica" | "fastf1-partial";
  round: number;
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  progression: {
    rounds: { round: number; name: string }[];
    drivers: Record<string, number[]>;
    constructors: Record<string, number[]>;
  };
  rounds_included: number[];
}

export interface ReplayDriver {
  code: string;
  number: string;
  team: string;
  team_color: string | null;
  progress: number[];
  finished_at: number;
  retired: boolean;
  grid: number | null;
  laps_completed: number;
  pits: { start: number; end: number | null; lap: number | null }[];
  stints: { compound: string; start_lap: number | null; end_lap: number | null }[];
}

export interface ReplayResponse extends SessionContext {
  start: number;
  end: number;
  step: number;
  frames: number;
  total_laps: number | null;
  progress_scale: number;
  drivers: ReplayDriver[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  offline: boolean;
  loaded_sessions: { season: number; round: number; session: string }[];
}

// --- Strategy simulator ---------------------------------------------------

export interface PlanStint {
  compound: string;
  laps: number;
  start_age?: number;
}

export interface CompoundCurve {
  compound: string;
  offset: number | null;
  wear: number | null;
  life: number | null;
  samples: number;
  source: "fitted" | "estimated" | "prior";
  points: { age: number; delta: number | null }[];
}

export interface SimulatorModelResponse extends SessionContext {
  reference: string;
  total_laps: number;
  fuel_effect: number | null;
  pit_loss: number | null;
  pit_loss_source: string;
  lap_noise: number | null;
  fit_r2: number | null;
  wet: boolean;
  mixed_conditions: boolean;
  viable_laps: Record<string, [number, number][]>;
  neutralised: { lap: number; kind: string }[];
  compounds: CompoundCurve[];
  driver_pace: { code: string; pace: number | null; gap: number | null }[];
  driver: string | null;
  actual_plan: PlanStint[];
}

export interface SimulationResponse extends SessionContext {
  driver: string;
  plan: string;
  actual_plan: string;
  laps: number;
  warnings: string[];
  stops: number;
  hindsight: { delta: number | null; race_time: number | null; position: number; actual_position: number | null };
  monte_carlo: {
    runs: number;
    sc_rate: number;
    vsc_rate: number;
    delta_mean: number | null;
    delta_p10: number | null;
    delta_p90: number | null;
    better_share: number | null;
    position_mean: number | null;
    position_histogram: { position: number; share: number | null }[];
  };
  laps_detail: { lap: number; plan: number | null; actual: number | null; gap: number | null }[];
}

export interface RankedPlan {
  plan: string;
  stops: number;
  stints: PlanStint[];
  pit_laps: number[];
  delta: number | null;
  position: number;
}

export interface OptimiseResponse extends SessionContext {
  driver: string;
  conditions: "green" | "hindsight";
  laps: number;
  actual_plan: string;
  actual_position: number | null;
  evaluated: number;
  plans: RankedPlan[];
}

export interface PitScenario {
  attacker_pits: number;
  defender_pits: number;
  final_gap: number | null;
  attacker_ahead: boolean;
  gaps: { lap: number; gap: number | null }[];
}

export interface UndercutResponse extends SessionContext {
  attacker: string;
  defender: string;
  lap: number;
  gap: number | null;
  attacker_tyre: { compound: string; age: number; next: string };
  defender_tyre: { compound: string; age: number; next: string };
  fresh_tyre_gain: number | null;
  pit_loss: number | null;
  undercut: PitScenario;
  overcut: PitScenario;
  verdict: "undercut" | "overcut" | "stay" | "safe" | "cover" | "stay-out" | "lose";
}

// --- Live race mode ---------------------------------------------------------

export interface LiveDriver {
  number: string;
  code: string;
  name: string;
  team: string | null;
  team_color: string | null;
  position: number;
  gap: number | null;
  laps_down: number;
  interval: number | null;
  laps: number | null;
  last_lap: number | null;
  last_lap_personal_best: boolean;
  last_lap_overall_best: boolean;
  best_lap: number | null;
  in_pit: boolean;
  pit_out: boolean;
  pit_stops: number;
  retired: boolean;
  compound: string | null;
  tyre_age: number | null;
  new_tyre: boolean;
  compounds_used: string[];
}

export interface LivePitWindow {
  number: string;
  code: string;
  position: number;
  rejoin_position: number;
  positions_lost: number;
  car_ahead: string | null;
  gap_ahead: number | null;
  car_behind: string | null;
  gap_behind: number | null;
  free_stop: boolean;
  owes_stop: boolean;
}

export interface LiveProbability {
  number: string;
  code: string;
  team_color: string | null;
  win: number;
  podium: number;
  pace: number;
}

export type LiveAlertKind =
  | "safety-car" | "red-flag" | "vsc" | "green" | "lead-change" | "fastest-lap" | "pit"
  | "retirement" | "penalty" | "investigation" | "chequered" | "rain";

export interface LiveAlert {
  kind: LiveAlertKind;
  severity: string;
  title: string;
  message: string;
  lap: number | null;
  clock: string | null;
}

export interface LiveSnapshot {
  type: "snapshot";
  clock: string;
  session: { name: string | null; type: string | null; meeting: string | null; circuit: string | null; status: string | null };
  lap: number | null;
  total_laps: number | null;
  laps_left: number;
  track_status: { code: string; label: string };
  drivers: LiveDriver[];
  race_control: { utc: string | null; lap: number | null; category: string | null; flag: string | null; scope: string | null; message: string }[];
  weather: { air: number | null; track: number | null; humidity: number | null; wind: number | null; rain: boolean } | null;
  pit_loss: number;
  pit_window: LivePitWindow[];
  probabilities: LiveProbability[];
  alerts: LiveAlert[];
  replay?: { position: number; duration: number; speed: number; paused: boolean };
}

export interface LiveStatus {
  now_utc: string;
  live: { season: number; round: number; event: string; session: string; name: string; start_utc: string } | null;
  next: { season: number; round: number; event: string; session: string; name: string; start_utc: string } | null;
  feed_running: boolean;
  viewers: number;
}

// --- Driver & car analysis ----------------------------------------------------

export interface CornerStyle {
  number: number | null;
  letter: string;
  class: "slow" | "medium" | "fast";
  apex_distance: number | null;
  brake_point: number | null;
  braked: boolean;
  entry_speed: number | null;
  apex_speed: number | null;
  exit_speed: number | null;
  gear: number;
  throttle_pickup: number | null;
  time: number | null;
}

export interface StyleResponse extends SessionContext {
  axes: { key: string; label: string; description: string }[];
  drivers: {
    code: string;
    team: string;
    team_color: string | null;
    lap: { lap: number | null; time: number | null } | null;
    scores: Record<string, number | null>;
    raw: Record<string, number | null>;
    corners: CornerStyle[];
  }[];
  field_size: number;
  comparison: { corner: string; class: string; time_delta: number | null; apex_delta: number | null; brake_delta: number | null }[];
}

export interface IdealLapResponse extends SessionContext {
  driver: DriverInfo;
  laps_used: number[];
  fastest_lap: { lap: number | null; time: number | null };
  ideal_time: number | null;
  gain: number | null;
  sector_theoretical: number | null;
  minisectors: {
    index: number;
    start: number | null;
    end: number | null;
    best: number | null;
    best_lap: number;
    sector: number;
    fastest_lap_time: number | null;
    loss: number | null;
  }[];
  field: { code: string; team: string; team_color: string | null; best: number | null; theoretical: number | null; gain: number | null }[];
}

export interface TeamCar {
  team: string;
  team_color: string | null;
  driver: string;
  lap_time: number | null;
  speed_trap: number | null;
  top_speed: number | null;
  slow_corners: number | null;
  medium_corners: number | null;
  fast_corners: number | null;
  full_throttle: number | null;
  straight_index: number | null;
  corner_index: number | null;
  drag_bias: number | null;
  profile: "Low drag" | "High downforce" | "Balanced";
}

export interface CarsResponse extends SessionContext {
  teams: TeamCar[];
}

export interface TyreManagementResponse extends SessionContext {
  compound_median: Record<string, number | null>;
  drivers: {
    code: string;
    team: string | null;
    team_color: string | null;
    relative_degradation: number | null;
    consistency: number | null;
    stints: number;
    score: number;
  }[];
  teammates: { team: string | null; drivers: string[]; delta: number | null }[];
}

export interface TeammatePair {
  team: string;
  team_color: string | null;
  drivers: string[];
  race: number[];
  quali: number[];
  points: (number | null)[];
  pace_gap: number | null;
  pace_races: number;
  races: number;
  rounds: { round: number; race: string | null; quali: string | null; quali_source: string | null; pace_gap: number | null }[];
}

export interface TeammateBattleResponse {
  season: number;
  rounds: number[];
  pairs: TeammatePair[];
  ingested: { season: number; round: number; session: string }[];
}
