"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { PageHeader } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Button, Segmented } from "@/components/ui/primitives";
import { API_BASE_URL } from "@/lib/api/client";
import { useHealth } from "@/lib/api/queries";
import type { Severity } from "@/lib/api/types";
import { TEAM_THEMES, liveryGradient, type TeamKey } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { clearNotices, pushNotice } from "@/state/notifications";
import { usePreferences } from "@/state/preferences";

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-line py-4 last:border-0">
      <div className="max-w-md">
        <div className="text-[14px] font-semibold">{title}</div>
        <div className="text-[13px] text-ink-3">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { prefs, update, reset } = usePreferences();
  const { resolvedTheme, setTheme } = useTheme();
  const health = useHealth();
  const qc = useQueryClient();
  const teams = (Object.keys(TEAM_THEMES) as TeamKey[]).filter((k) => k !== "neutral");

  return (
    <>
      <PageHeader title="Settings" description="Saved in this browser only." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Panel title="Display">
            <Row title="Appearance" description="Dark suits the pit wall; light is easier on paper and in daylight.">
              <Segmented
                label="Appearance"
                value={resolvedTheme === "light" ? "light" : "dark"}
                onChange={(v) => setTheme(v)}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
              />
            </Row>
            <Row title="Speed" description="Used on telemetry traces, corner tables and speed traps.">
              <Segmented label="Speed unit" value={prefs.speedUnit} onChange={(v) => update({ speedUnit: v })} options={[{ value: "kmh", label: "km/h" }, { value: "mph", label: "mph" }]} />
            </Row>
            <Row title="Temperature" description="Used on the weather page.">
              <Segmented label="Temperature unit" value={prefs.tempUnit} onChange={(v) => update({ tempUnit: v })} options={[{ value: "c", label: "°C" }, { value: "f", label: "°F" }]} />
            </Row>
            <Row title="Motion" description="Reduce animation of team colour changes and the replay.">
              <Segmented
                label="Motion"
                value={prefs.motion}
                onChange={(v) => update({ motion: v })}
                options={[
                  { value: "system", label: "System" },
                  { value: "reduced", label: "Reduced" },
                  { value: "full", label: "Full" },
                ]}
              />
            </Row>
          </Panel>

          <Panel title="Team colours">
            <Row title="Theme follows" description="Re-colour the dashboard for the focused driver's team, lock it to one team, or keep it neutral.">
              <Segmented
                label="Team theming"
                value={prefs.teamTheming}
                onChange={(v) => update({ teamTheming: v })}
                options={[
                  { value: "driver", label: "Focus driver" },
                  { value: "fixed", label: "One team" },
                  { value: "off", label: "Neutral" },
                ]}
              />
            </Row>
            <div className={cn("grid grid-cols-2 gap-2 pt-4 sm:grid-cols-3 lg:grid-cols-4", prefs.teamTheming !== "fixed" && "opacity-50")}>
              {teams.map((k) => {
                const t = TEAM_THEMES[k];
                const active = prefs.teamTheming === "fixed" && prefs.fixedTeam === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ teamTheming: "fixed", fixedTeam: k })}
                    className={cn("overflow-hidden rounded-md border text-left transition-colors", active ? "border-team ring-2 ring-team/40" : "border-line hover:border-line-strong")}
                  >
                    <span className="block h-8" style={{ background: liveryGradient(t) }} />
                    <span className="block px-2.5 py-1.5 text-[13px] font-semibold">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Race control alerts">
            <Row title="Alerts during replay" description="Pop up race control messages as the replay clock passes them.">
              <Segmented label="Replay alerts" value={prefs.alerts ? "on" : "off"} onChange={(v) => update({ alerts: v === "on" })} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
            </Row>
            <Row title="Show alerts for" description="Lower thresholds include blue flags, track limits and DRS messages.">
              <Segmented<Severity>
                label="Alert threshold"
                value={prefs.alertThreshold}
                onChange={(v) => update({ alertThreshold: v })}
                options={[
                  { value: "critical", label: "Red & SC" },
                  { value: "high", label: "+ Penalties" },
                  { value: "medium", label: "+ Yellows" },
                  { value: "low", label: "Everything" },
                ]}
              />
            </Row>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => pushNotice({ kind: "sc", severity: "critical", title: "Safety Car Deployed", message: "This is how race control alerts will look.", lap: null, source: "system" })}>
                Preview an alert
              </Button>
              <Button variant="ghost" onClick={clearNotices}>
                Clear alert history
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Data connection">
            <dl className="space-y-3 text-[13.5px]">
              <div>
                <dt className="text-xs text-ink-3">API</dt>
                <dd className="font-mono text-[12.5px] break-all">{API_BASE_URL}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Status</dt>
                <dd className={cn("font-semibold", health.data?.status === "ok" ? "text-good" : "text-bad")}>
                  {health.isLoading ? "Checking…" : health.data?.status === "ok" ? `Online · v${health.data.version}${health.data.offline ? " · offline cache only" : ""}` : "Unreachable"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Sessions held in memory</dt>
                <dd>
                  {health.data?.loaded_sessions.length
                    ? health.data.loaded_sessions.map((s) => `${s.season} R${s.round} ${s.session}`).join(", ")
                    : "None yet"}
                </dd>
              </div>
            </dl>
            <Button variant="outline" className="mt-4" onClick={() => qc.invalidateQueries()}>
              Refetch all data
            </Button>
          </Panel>
          <Panel title="Reset">
            <p className="text-[13px] text-ink-3">Restore units, theming and alert settings to their defaults.</p>
            <Button variant="outline" className="mt-3" onClick={reset}>
              Reset settings
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}
