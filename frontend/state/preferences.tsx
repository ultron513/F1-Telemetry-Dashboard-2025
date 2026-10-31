"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Severity } from "@/lib/api/types";
import type { SpeedUnit, TempUnit } from "@/lib/format";
import type { TeamKey } from "@/lib/teams";

export interface Preferences {
  speedUnit: SpeedUnit;
  tempUnit: TempUnit;
  /** "driver": livery follows the focused driver; "fixed": always fixedTeam; "off": neutral. */
  teamTheming: "driver" | "fixed" | "off";
  fixedTeam: TeamKey;
  alerts: boolean;
  alertThreshold: Severity;
  motion: "system" | "reduced" | "full";
}

export const DEFAULT_PREFERENCES: Preferences = {
  speedUnit: "kmh",
  tempUnit: "c",
  teamTheming: "driver",
  fixedTeam: "ferrari",
  alerts: true,
  alertThreshold: "medium",
  motion: "system",
};

const STORAGE_KEY = "pitwall.preferences.v1";

interface Ctx {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
  reset: () => void;
  hydrated: boolean;
}

const PreferencesContext = createContext<Ctx | null>(null);

function readStored(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from storage after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable (private mode) */
    }
    const root = document.documentElement;
    const reduce =
      prefs.motion === "reduced" ||
      (prefs.motion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    root.dataset.motion = reduce ? "reduced" : "full";
  }, [prefs, hydrated]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
  }, []);
  const reset = useCallback(() => setPrefs(DEFAULT_PREFERENCES), []);

  const value = useMemo(() => ({ prefs, update, reset, hydrated }), [prefs, update, reset, hydrated]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
