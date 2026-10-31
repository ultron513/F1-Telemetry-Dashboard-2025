// Team identity registry: colours and livery-inspired bands for every
// constructor from 2023 to 2026. Only colours and abstract stripe
// geometry are used — no logos or marks.

export type TeamKey =
  | "red_bull"
  | "ferrari"
  | "mclaren"
  | "mercedes"
  | "aston_martin"
  | "alpine"
  | "williams"
  | "rb"
  | "alphatauri"
  | "sauber"
  | "alfa_romeo"
  | "haas"
  | "audi"
  | "cadillac"
  | "neutral";

type Stop = [color: "deep" | "primary" | "secondary" | "tertiary", from: number, to: number];

export interface TeamTheme {
  key: TeamKey;
  name: string;
  primary: string;
  secondary: string;
  tertiary: string;
  deep: string;
  onPrimary: string;
  /** Livery band: angle + colour stops (percent), rendered as a hard-edged gradient. */
  livery: { angle: number; stops: Stop[] };
}

const T = (t: TeamTheme) => t;

export const TEAM_THEMES: Record<TeamKey, TeamTheme> = {
  red_bull: T({
    key: "red_bull",
    name: "Red Bull Racing",
    primary: "#3671C6",
    secondary: "#E8102D",
    tertiary: "#FFC906",
    deep: "#0B1530",
    onPrimary: "#FFFFFF",
    livery: { angle: 98, stops: [["deep", 0, 62], ["primary", 62, 84], ["secondary", 84, 89], ["tertiary", 89, 91], ["primary", 91, 100]] },
  }),
  ferrari: T({
    key: "ferrari",
    name: "Ferrari",
    primary: "#E80020",
    secondary: "#FFE600",
    tertiary: "#FFFFFF",
    deep: "#2A0407",
    onPrimary: "#FFFFFF",
    livery: { angle: 104, stops: [["deep", 0, 56], ["primary", 56, 90], ["secondary", 90, 92.5], ["primary", 92.5, 100]] },
  }),
  mclaren: T({
    key: "mclaren",
    name: "McLaren",
    primary: "#FF8000",
    secondary: "#47C7FC",
    tertiary: "#1E1E1E",
    deep: "#1C1209",
    onPrimary: "#140A00",
    livery: { angle: 118, stops: [["deep", 0, 50], ["tertiary", 50, 58], ["primary", 58, 86], ["secondary", 86, 89], ["primary", 89, 100]] },
  }),
  mercedes: T({
    key: "mercedes",
    name: "Mercedes",
    primary: "#27F4D2",
    secondary: "#C6CBCD",
    tertiary: "#0A0A0A",
    deep: "#03130F",
    onPrimary: "#00211B",
    livery: { angle: 112, stops: [["deep", 0, 60], ["secondary", 60, 63], ["tertiary", 63, 78], ["primary", 78, 100]] },
  }),
  aston_martin: T({
    key: "aston_martin",
    name: "Aston Martin",
    primary: "#229971",
    secondary: "#CEDC00",
    tertiary: "#0B3D2E",
    deep: "#03201A",
    onPrimary: "#FFFFFF",
    livery: { angle: 100, stops: [["deep", 0, 58], ["tertiary", 58, 72], ["primary", 72, 94], ["secondary", 94, 96], ["primary", 96, 100]] },
  }),
  alpine: T({
    key: "alpine",
    name: "Alpine",
    primary: "#0093CC",
    secondary: "#FF87BC",
    tertiary: "#0A2F6B",
    deep: "#04122A",
    onPrimary: "#FFFFFF",
    livery: { angle: 120, stops: [["deep", 0, 55], ["tertiary", 55, 66], ["primary", 66, 86], ["secondary", 86, 100]] },
  }),
  williams: T({
    key: "williams",
    name: "Williams",
    primary: "#64C4FF",
    secondary: "#1868DB",
    tertiary: "#E8F4FF",
    deep: "#041A3A",
    onPrimary: "#04172E",
    livery: { angle: 96, stops: [["deep", 0, 64], ["secondary", 64, 82], ["primary", 82, 96], ["tertiary", 96, 100]] },
  }),
  rb: T({
    key: "rb",
    name: "Racing Bulls",
    primary: "#6692FF",
    secondary: "#F4F4F4",
    tertiary: "#E8102D",
    deep: "#0B1440",
    onPrimary: "#FFFFFF",
    livery: { angle: 108, stops: [["deep", 0, 60], ["secondary", 60, 74], ["primary", 74, 95], ["tertiary", 95, 100]] },
  }),
  alphatauri: T({
    key: "alphatauri",
    name: "AlphaTauri",
    primary: "#5E8FAA",
    secondary: "#F4F4F4",
    tertiary: "#1B2F45",
    deep: "#0B1724",
    onPrimary: "#FFFFFF",
    livery: { angle: 100, stops: [["deep", 0, 62], ["tertiary", 62, 74], ["primary", 74, 96], ["secondary", 96, 100]] },
  }),
  sauber: T({
    key: "sauber",
    name: "Kick Sauber",
    primary: "#52E252",
    secondary: "#0A0A0A",
    tertiary: "#C5FFC5",
    deep: "#061A08",
    onPrimary: "#031A05",
    livery: { angle: 125, stops: [["deep", 0, 58], ["secondary", 58, 70], ["primary", 70, 92], ["tertiary", 92, 94], ["primary", 94, 100]] },
  }),
  alfa_romeo: T({
    key: "alfa_romeo",
    name: "Alfa Romeo",
    primary: "#C92D4B",
    secondary: "#FFFFFF",
    tertiary: "#5A0F1E",
    deep: "#1E050A",
    onPrimary: "#FFFFFF",
    livery: { angle: 102, stops: [["deep", 0, 60], ["tertiary", 60, 70], ["primary", 70, 95], ["secondary", 95, 100]] },
  }),
  haas: T({
    key: "haas",
    name: "Haas",
    primary: "#B6BABD",
    secondary: "#E6002B",
    tertiary: "#2A2D30",
    deep: "#121416",
    onPrimary: "#111315",
    livery: { angle: 110, stops: [["deep", 0, 56], ["tertiary", 56, 68], ["primary", 68, 90], ["secondary", 90, 94], ["primary", 94, 100]] },
  }),
  audi: T({
    key: "audi",
    name: "Audi",
    primary: "#F50537",
    secondary: "#A7ADB4",
    tertiary: "#1A1B1E",
    deep: "#140508",
    onPrimary: "#FFFFFF",
    livery: { angle: 100, stops: [["deep", 0, 58], ["tertiary", 58, 72], ["secondary", 72, 88], ["primary", 88, 100]] },
  }),
  cadillac: T({
    key: "cadillac",
    name: "Cadillac",
    primary: "#D8D8D8",
    secondary: "#B8962E",
    tertiary: "#1A1A1A",
    deep: "#101010",
    onPrimary: "#101010",
    livery: { angle: 106, stops: [["deep", 0, 60], ["tertiary", 60, 72], ["primary", 72, 94], ["secondary", 94, 96], ["primary", 96, 100]] },
  }),
  neutral: T({
    key: "neutral",
    name: "Pit Wall",
    primary: "#E10600",
    secondary: "#F2F2F2",
    tertiary: "#3A3F47",
    deep: "#14171C",
    onPrimary: "#FFFFFF",
    livery: { angle: 104, stops: [["deep", 0, 64], ["tertiary", 64, 80], ["primary", 80, 96], ["secondary", 96, 100]] },
  }),
};

const MATCHERS: [RegExp, TeamKey][] = [
  [/racing bulls|visa ?cash ?app|^rb$|\brb f1\b|vcarb/i, "rb"],
  [/alpha ?tauri/i, "alphatauri"],
  [/red ?bull/i, "red_bull"],
  [/ferrari/i, "ferrari"],
  [/mclaren/i, "mclaren"],
  [/mercedes/i, "mercedes"],
  [/aston/i, "aston_martin"],
  [/alpine/i, "alpine"],
  [/williams/i, "williams"],
  [/alfa/i, "alfa_romeo"],
  [/sauber|kick|stake/i, "sauber"],
  [/haas/i, "haas"],
  [/audi/i, "audi"],
  [/cadillac/i, "cadillac"],
];

export function teamKey(nameOrId: string | null | undefined): TeamKey {
  if (!nameOrId) return "neutral";
  const value = nameOrId.replace(/_/g, " ").trim();
  for (const [re, key] of MATCHERS) if (re.test(value)) return key;
  return "neutral";
}

export function teamTheme(nameOrId: string | null | undefined): TeamTheme {
  return TEAM_THEMES[teamKey(nameOrId)];
}

/** Series colour for a team: official FastF1 colour when present, else the registry. */
export function teamColor(team: string | null | undefined, apiColor?: string | null): string {
  if (apiColor && /^#[0-9A-F]{6}$/i.test(apiColor)) return apiColor;
  return teamTheme(team).primary;
}

export function liveryGradient(theme: TeamTheme): string {
  const parts = theme.livery.stops.map(
    ([c, from, to]) => `${theme[c]} ${from}% ${to}%`,
  );
  return `linear-gradient(${theme.livery.angle}deg, ${parts.join(", ")})`;
}

export function themeCssVars(theme: TeamTheme): Record<string, string> {
  return {
    "--team-primary": theme.primary,
    "--team-secondary": theme.secondary,
    "--team-tertiary": theme.tertiary,
    "--team-deep": theme.deep,
    "--team-on-primary": theme.onPrimary,
  };
}

/** Two teammates share a colour; the second one is drawn dashed. */
export function seriesStyles<T extends { code: string; team: string | null; team_color?: string | null }>(
  items: T[],
): Map<string, { color: string; dashed: boolean }> {
  const seen = new Map<string, number>();
  const out = new Map<string, { color: string; dashed: boolean }>();
  for (const item of items) {
    const color = teamColor(item.team, item.team_color);
    const n = seen.get(color) ?? 0;
    seen.set(color, n + 1);
    out.set(item.code, { color, dashed: n > 0 });
  }
  return out;
}
