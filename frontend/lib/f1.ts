import type { MessageKind, Severity } from "./api/types";

export const COMPOUNDS: Record<string, { label: string; short: string; color: string; ink: string }> = {
  SOFT: { label: "Soft", short: "S", color: "#FF3B3B", ink: "#FFFFFF" },
  MEDIUM: { label: "Medium", short: "M", color: "#FFD12E", ink: "#1A1400" },
  HARD: { label: "Hard", short: "H", color: "#EDEDED", ink: "#111111" },
  INTERMEDIATE: { label: "Intermediate", short: "I", color: "#3CC24A", ink: "#03140A" },
  WET: { label: "Wet", short: "W", color: "#2E7BFF", ink: "#FFFFFF" },
  UNKNOWN: { label: "Unknown", short: "?", color: "#6B7280", ink: "#FFFFFF" },
  TEST_UNKNOWN: { label: "Test", short: "T", color: "#6B7280", ink: "#FFFFFF" },
};

export function compound(c: string | null | undefined) {
  return COMPOUNDS[(c ?? "UNKNOWN").toUpperCase()] ?? COMPOUNDS.UNKNOWN;
}

/** F1 timing-screen colours. */
export const TIMING = {
  purple: "#B14BFF",
  green: "#2BD46A",
  yellow: "#F5C518",
};

export const TRACK_STATUS: Record<string, { label: string; color: string; ink: string }> = {
  "1": { label: "Green", color: "#1FAE5B", ink: "#04140A" },
  "2": { label: "Yellow", color: "#F5C518", ink: "#1A1400" },
  "4": { label: "Safety Car", color: "#F59E0B", ink: "#1A0E00" },
  "5": { label: "Red Flag", color: "#E5132B", ink: "#FFFFFF" },
  "6": { label: "VSC", color: "#FBBF24", ink: "#1A1000" },
  "7": { label: "VSC Ending", color: "#FCD34D", ink: "#1A1000" },
};

export const MESSAGE_STYLE: Record<MessageKind, { color: string; ink: string; group: string }> = {
  red: { color: "#E5132B", ink: "#FFFFFF", group: "Flags" },
  sc: { color: "#F59E0B", ink: "#1A0E00", group: "Safety car" },
  vsc: { color: "#FBBF24", ink: "#1A1000", group: "Safety car" },
  yellow: { color: "#F5C518", ink: "#1A1400", group: "Flags" },
  double_yellow: { color: "#F5C518", ink: "#1A1400", group: "Flags" },
  green: { color: "#1FAE5B", ink: "#FFFFFF", group: "Flags" },
  clear: { color: "#1FAE5B", ink: "#FFFFFF", group: "Flags" },
  blue: { color: "#2E7BFF", ink: "#FFFFFF", group: "Flags" },
  chequered: { color: "#F2F2F2", ink: "#111111", group: "Flags" },
  black_white: { color: "#F2F2F2", ink: "#111111", group: "Penalties" },
  black_orange: { color: "#FF7A1A", ink: "#1A0A00", group: "Penalties" },
  penalty: { color: "#FF4D6D", ink: "#FFFFFF", group: "Penalties" },
  investigation: { color: "#A78BFA", ink: "#14082E", group: "Stewards" },
  track_limits: { color: "#94A3B8", ink: "#0B1220", group: "Stewards" },
  drs: { color: "#22D3EE", ink: "#03181C", group: "DRS" },
  weather: { color: "#60A5FA", ink: "#04122A", group: "Other" },
  pit: { color: "#94A3B8", ink: "#0B1220", group: "Other" },
  info: { color: "#64748B", ink: "#FFFFFF", group: "Other" },
};

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export const SESSION_LABEL: Record<string, string> = {
  FP1: "Practice 1",
  FP2: "Practice 2",
  FP3: "Practice 3",
  Q: "Qualifying",
  SQ: "Sprint Quali",
  SS: "Sprint Shootout",
  S: "Sprint",
  R: "Race",
};
