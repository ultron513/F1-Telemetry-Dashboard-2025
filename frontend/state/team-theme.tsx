"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import { TEAM_THEMES, liveryGradient, teamTheme, themeCssVars, type TeamTheme } from "@/lib/teams";

import { usePreferences } from "./preferences";
import { useSelection } from "./selection";

const ThemeCtx = createContext<TeamTheme>(TEAM_THEMES.neutral);

/**
 * Pushes the active team's colours into CSS custom properties on <html>.
 * The properties are registered with @property in globals.css, so a team
 * change cross-fades the whole interface instead of snapping.
 */
export function TeamThemeProvider({ children }: { children: React.ReactNode }) {
  const { prefs } = usePreferences();
  const { focus } = useSelection();

  const theme = useMemo(() => {
    if (prefs.teamTheming === "off") return TEAM_THEMES.neutral;
    if (prefs.teamTheming === "fixed") return TEAM_THEMES[prefs.fixedTeam] ?? TEAM_THEMES.neutral;
    return focus ? teamTheme(focus.team) : TEAM_THEMES.neutral;
  }, [prefs.teamTheming, prefs.fixedTeam, focus]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeCssVars(theme))) root.style.setProperty(k, v);
    root.style.setProperty("--team-livery", liveryGradient(theme));
    root.dataset.team = theme.key;
  }, [theme]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useTeamTheme() {
  return useContext(ThemeCtx);
}
