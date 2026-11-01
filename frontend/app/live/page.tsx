"use client";

import { Bell, BellOff, Pause, Play, Radio } from "lucide-react";
import { useMemo, useState } from "react";

import { TeamStripe, Tyre } from "@/components/f1/bits";
import { PageHeader } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Button, Empty, Loading, Segmented, Stat } from "@/components/ui/primitives";
import { useLiveStatus } from "@/lib/api/queries";
import type { LiveAlert, LiveDriver, LivePitWindow, LiveSnapshot } from "@/lib/api/types";
import { SESSION_LABEL, SEVERITY_RANK, TIMING, TRACK_STATUS } from "@/lib/f1";
import { clock, dateTime, lapTime } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { pushNotice } from "@/state/notifications";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";
import { ALERT_STYLE, useDesktopNotifications, useLiveFeed, type LiveSource } from "@/state/live";

const SPEEDS = [1, 5, 20, 60] as const;

export default function LivePage() {
  const { season, round, session, driver, set } = useSelection();
  const status = useLiveStatus();
  const liveNow = status.data?.live ?? null;
  const [mode, setMode] = useState<"live" | "archive">("archive");
  const [speed, setSpeedState] = useState<number>(20);
  const { prefs } = usePreferences();
  const desktop = useDesktopNotifications();

  const source: LiveSource | null = useMemo(() => {
    if (mode === "live") return { mode: "live" };
    if (!season || !round || !session) return null;
    // Speed is sent over the socket after connecting, so it isn't part of the key.
    return { mode: "archive", season, round, session, speed: 20, start: 0 };
  }, [mode, season, round, session]);

  const onAlerts = (alerts: LiveAlert[]) => {
    for (const a of alerts) {
      const style = ALERT_STYLE[a.kind] ?? { kind: "info", severity: "info" };
      const show = prefs.alerts && SEVERITY_RANK[style.severity] >= SEVERITY_RANK[prefs.alertThreshold];
      pushNotice(
        { kind: style.kind, severity: style.severity, title: a.title, message: a.message, lap: a.lap, source: "feed" },
        { toast: show },
      );
      if (show) desktop.notify(a.title, a.message);
    }
  };
  const feed = useLiveFeed(source, onAlerts);
  const snap = feed.snapshot;

  return (
    <>
      <PageHeader
        title="Live race centre"
        description={
          mode === "live"
            ? "Streaming F1's live timing feed: running order, gaps, tyres, pit windows and win chances, updated every second."
            : `Watch ${SESSION_LABEL[session ?? "R"]?.toLowerCase() ?? "the session"} unfold as if it were live, from F1's own timing feed — at any speed.`
        }
        actions={
          <>
            <Segmented
              label="Feed"
              value={mode}
              onChange={setMode}
              options={[
                { value: "archive", label: "Race replay" },
                {
                  value: "live",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Radio className={cn("size-3.5", liveNow && "text-bad")} /> Live feed
                    </span>
                  ),
                  title: liveNow ? `${liveNow.event} ${liveNow.name} is on now` : "Nothing is running right now",
                },
              ]}
            />
            {desktop.permission !== "unsupported" && (
              <Button
                variant="outline"
                size="sm"
                onClick={desktop.request}
                disabled={desktop.permission !== "default"}
                title="Desktop alerts while this tab is in the background"
              >
                {desktop.permission === "granted" ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                {desktop.permission === "granted" ? "Desktop alerts on" : desktop.permission === "denied" ? "Alerts blocked" : "Desktop alerts"}
              </Button>
            )}
          </>
        }
      />

      {mode === "live" && !liveNow && (
        <Panel className="mb-4">
          <p className="text-[13.5px] text-ink-2">
            No session is running right now.
            {status.data?.next && (
              <>
                {" "}
                Next up: <strong className="text-ink">{status.data.next.event} — {status.data.next.name}</strong>, {dateTime(status.data.next.start_utc)}.
              </>
            )}{" "}
            The feed will connect as soon as cars are on track; switch to <em>Race replay</em> to try live mode with a past race.
          </p>
        </Panel>
      )}

      {feed.error ? (
        <Panel>
          <Empty>{feed.error}</Empty>
        </Panel>
      ) : !snap ? (
        <Loading label={feed.status === "connecting" ? "Connecting to the timing feed…" : "Waiting for timing data…"} className="min-h-[40vh]" />
      ) : (
        <div className="space-y-4">
          <StatusBar
            snap={snap}
            connection={feed.status}
            speed={speed}
            onSpeed={(s) => {
              setSpeedState(s);
              feed.setSpeed(s);
            }}
            onPause={feed.setPaused}
            onSeek={feed.seek}
          />
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <Panel accent title="Timing" subtitle="Select a car to follow it. “Pit now” shows where it would rejoin." flush bodyClassName="pb-2">
              <Tower snap={snap} focus={driver} onFocus={(c) => set({ driver: c })} />
            </Panel>
            <div className="grid content-start gap-4 lg:grid-cols-2 2xl:grid-cols-1">
              <Probabilities snap={snap} />
              <PitWindow snap={snap} focus={driver} />
              <Feed snap={snap} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBar({
  snap,
  connection,
  speed,
  onSpeed,
  onPause,
  onSeek,
}: {
  snap: LiveSnapshot;
  connection: string;
  speed: number;
  onSpeed: (s: number) => void;
  onPause: (p: boolean) => void;
  onSeek: (s: number) => void;
}) {
  const ts = TRACK_STATUS[snap.track_status.code] ?? TRACK_STATUS["1"];
  const replay = snap.replay;
  const [scrub, setScrub] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3">
      <span className="rounded px-2.5 py-1 text-[13px] font-semibold tracking-wide uppercase" style={{ background: ts.color, color: ts.ink }}>
        {snap.track_status.label}
      </span>
      <Stat label="Lap" value={snap.lap != null ? `${snap.lap}${snap.total_laps ? ` / ${snap.total_laps}` : ""}` : "—"} />
      <Stat label="Session clock" value={snap.clock.slice(0, 8)} />
      {snap.weather && (
        <Stat
          label="Track / air"
          value={`${snap.weather.track?.toFixed(0) ?? "—"}° / ${snap.weather.air?.toFixed(0) ?? "—"}°`}
          sub={snap.weather.rain ? "Rain" : "Dry"}
        />
      )}
      <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <span className={cn("size-2 rounded-full", connection === "open" ? "bg-good" : connection === "ended" ? "bg-ink-3" : "bg-warn")} />
        {connection === "open" ? (replay ? "Replaying" : "Live") : connection === "ended" ? "Finished" : "Reconnecting"}
      </span>
      {replay && (
        <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => onPause(!replay.paused)} aria-label={replay.paused ? "Play" : "Pause"}>
            {replay.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </Button>
          <Segmented
            label="Playback speed"
            size="sm"
            value={String(speed)}
            onChange={(v) => onSpeed(Number(v))}
            options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
          />
          <input
            type="range"
            min={0}
            max={replay.duration}
            step={10}
            value={scrub ?? replay.position}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={() => {
              if (scrub != null) onSeek(scrub);
              setScrub(null);
            }}
            onKeyUp={() => {
              if (scrub != null) onSeek(scrub);
              setScrub(null);
            }}
            className="min-w-[160px] flex-1 accent-team"
            aria-label="Replay position"
          />
          <span className="tnum text-[12.5px] text-ink-3">
            {clock(scrub ?? replay.position)} / {clock(replay.duration)}
          </span>
        </div>
      )}
    </div>
  );
}

function gapText(d: LiveDriver, key: "gap" | "interval") {
  if (d.retired) return "OUT";
  if (d.in_pit) return "PIT";
  if (d.laps_down) return `+${d.laps_down} LAP${d.laps_down > 1 ? "S" : ""}`;
  const v = d[key];
  if (v == null) return "—";
  if (d.position === 1) return key === "gap" ? "Leader" : "—";
  return `+${v.toFixed(v >= 60 ? 1 : 3)}`;
}

function Tower({ snap, focus, onFocus }: { snap: LiveSnapshot; focus: string | null; onFocus: (c: string) => void }) {
  const windows = useMemo(() => new Map(snap.pit_window.map((w) => [w.number, w])), [snap.pit_window]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-3 uppercase">
            <th className="w-10 py-2 pl-4 font-medium">Pos</th>
            <th className="py-2 font-medium">Driver</th>
            <th className="py-2 text-right font-medium">Gap</th>
            <th className="py-2 text-right font-medium">Int</th>
            <th className="py-2 text-right font-medium">Last lap</th>
            <th className="py-2 text-right font-medium">Best</th>
            <th className="py-2 pl-4 font-medium">Tyre</th>
            <th className="py-2 text-right font-medium">Stops</th>
            <th className="py-2 pr-4 text-right font-medium" title="Rejoin position if the car pitted this lap">
              Pit now
            </th>
          </tr>
        </thead>
        <tbody>
          {snap.drivers.map((d) => {
            const w = windows.get(d.number);
            const color = teamColor(d.team, d.team_color);
            const lastColor = d.last_lap_overall_best ? TIMING.purple : d.last_lap_personal_best ? TIMING.green : undefined;
            return (
              <tr
                key={d.number}
                onClick={() => onFocus(d.code)}
                className={cn(
                  "cursor-pointer border-b border-line/60 transition-colors hover:bg-surface-2",
                  focus === d.code && "bg-surface-2",
                  d.retired && "opacity-45",
                )}
                style={focus === d.code ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}
              >
                <td className="tnum py-1.5 pl-4 font-semibold text-ink">{d.position}</td>
                <td className="py-1.5">
                  <span className="flex items-center gap-2">
                    <TeamStripe team={d.team} color={d.team_color} />
                    <span className="font-semibold text-ink">{d.code}</span>
                    <span className="hidden truncate text-ink-3 xl:inline">{d.name}</span>
                  </span>
                </td>
                <td className="tnum py-1.5 text-right text-ink-2">{gapText(d, "gap")}</td>
                <td className="tnum py-1.5 text-right text-ink-2">{gapText(d, "interval")}</td>
                <td className="tnum py-1.5 text-right" style={{ color: lastColor }}>
                  {lapTime(d.last_lap)}
                </td>
                <td className="tnum py-1.5 text-right text-ink-3">{lapTime(d.best_lap)}</td>
                <td className="py-1.5 pl-4">
                  {d.compound ? <Tyre compound={d.compound} age={d.tyre_age} /> : <span className="text-ink-3">—</span>}
                </td>
                <td className="tnum py-1.5 text-right text-ink-2">{d.pit_stops}</td>
                <td className="tnum py-1.5 pr-4 text-right">
                  {w ? (
                    <span className={w.positions_lost <= 0 ? "text-good" : w.positions_lost > 3 ? "text-bad" : "text-ink-2"}>
                      P{w.rejoin_position}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Probabilities({ snap }: { snap: LiveSnapshot }) {
  const rows = snap.probabilities.filter((p) => p.podium >= 0.005).slice(0, 8);
  return (
    <Panel share title="Race outcome" subtitle={`Win and podium chances with ${snap.laps_left} laps to go, from recent pace, stops still owed and safety-car risk.`}>
      {rows.length === 0 ? (
        <Empty>Waiting for gaps.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.number} className="grid grid-cols-[2.75rem_1fr_3rem] items-center gap-2 text-[13px]">
              <span className="font-semibold text-ink">{p.code}</span>
              <span className="relative h-3 overflow-hidden rounded-full bg-surface-3">
                <span className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: `${p.podium * 100}%`, background: p.team_color ?? "var(--ink-3)" }} />
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p.win * 100}%`, background: p.team_color ?? "var(--ink-3)" }} />
              </span>
              <span className="tnum text-right text-ink">{Math.round(p.win * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-ink-3">Solid bar: win. Faded bar: podium.</p>
    </Panel>
  );
}

function PitWindow({ snap, focus }: { snap: LiveSnapshot; focus: string | null }) {
  const w: LivePitWindow | undefined = snap.pit_window.find((p) => p.code === focus) ?? snap.pit_window[0];
  return (
    <Panel title={`Pit window${w ? ` · ${w.code}` : ""}`} subtitle={`If the car stopped this lap (pit loss ${snap.pit_loss.toFixed(1)} s).`}>
      {!w ? (
        <Empty>Select a car on the lead lap.</Empty>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-ink">P{w.position}</span>
            <span className="text-ink-3">→</span>
            <span className={cn("text-3xl font-semibold", w.positions_lost <= 0 ? "text-good" : "text-warn")}>P{w.rejoin_position}</span>
          </div>
          <p className="text-[13.5px] text-ink-2">
            {w.car_ahead ? (
              <>
                Rejoins <strong className="text-ink">{w.gap_ahead?.toFixed(1)} s behind {w.car_ahead}</strong>
              </>
            ) : (
              <>Rejoins in the lead</>
            )}
            {w.car_behind ? (
              <>
                , <strong className="text-ink">{w.gap_behind?.toFixed(1)} s ahead of {w.car_behind}</strong>.
              </>
            ) : (
              "."
            )}{" "}
            {w.free_stop ? "A free stop — no places lost." : `Costs ${w.positions_lost} place${w.positions_lost === 1 ? "" : "s"} for now.`}
            {w.owes_stop && " Still owes a stop for the two-compound rule."}
          </p>
        </div>
      )}
    </Panel>
  );
}

function Feed({ snap }: { snap: LiveSnapshot }) {
  const msgs = [...snap.race_control].reverse().slice(0, 12);
  return (
    <Panel title="Race control" subtitle="Latest messages from the FIA" bodyClassName="max-h-[340px] overflow-y-auto">
      {msgs.length === 0 ? (
        <Empty>No messages yet.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {msgs.map((m, i) => (
            <li key={`${m.utc}-${i}`} className="text-[13px]">
              <div className="text-[11.5px] text-ink-3">
                {m.lap ? `Lap ${m.lap}` : ""}
                {m.flag ? ` · ${m.flag}` : ""}
              </div>
              <div className="text-ink-2">{m.message}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
