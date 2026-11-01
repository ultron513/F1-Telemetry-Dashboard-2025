"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TrackMap, type TrackCar } from "@/components/charts/track-map";
import { FlagChip, TrackStatusPill, Tyre } from "@/components/f1/bits";
import { OnboardHud } from "@/components/replay/onboard-hud";
import { Panel } from "@/components/ui/panel";
import { Button, ErrorState, Loading, Segmented } from "@/components/ui/primitives";
import { ShareButton } from "@/components/ui/share-button";
import { useCircuit, useCircuit3D, useOnboard, useRaceControl, useReplay } from "@/lib/api/queries";
import type { RaceControlMessage, ReplayResponse } from "@/lib/api/types";
import { SEVERITY_RANK, TRACK_STATUS } from "@/lib/f1";
import { clock } from "@/lib/format";
import { seriesStyles } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { pushNotice } from "@/state/notifications";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";

const SPEEDS = [1, 4, 10, 30, 60] as const;

interface CarState {
  code: string;
  team: string;
  color: string;
  dashed: boolean;
  progress: number; // laps (fractional)
  grid: number;
  gap: number | null;
  interval: number | null;
  inPit: boolean;
  out: boolean;
  finished: boolean;
  compound: string | null;
}

/** Live-timing style session replay: cars on the map, timing tower and race-control alerts. */
// WebGL only runs in the browser.
const Track3D = dynamic(() => import("@/components/charts/track-3d").then((m) => m.Track3D), {
  ssr: false,
  loading: () => <Loading label="Building the 3D circuit…" className="h-[480px]" />,
});

export function SessionReplay() {
  const { key } = useSelection();
  const replay = useReplay(key);
  const circuit = useCircuit(key);
  const rc = useRaceControl(key);

  if (replay.error) return <ErrorState error={replay.error} onRetry={() => replay.refetch()} />;
  if (!replay.data || !circuit.data || !rc.data) return <Loading label="Preparing the replay — sampling every car once a second…" className="min-h-[520px]" />;
  return <Player data={replay.data} outline={circuit.data} messages={rc.data.messages} trackStatus={rc.data.track_status} />;
}

function Player({
  data,
  outline,
  messages,
  trackStatus,
}: {
  data: ReplayResponse;
  outline: NonNullable<ReturnType<typeof useCircuit>["data"]>;
  messages: RaceControlMessage[];
  trackStatus: { status: string; start: number | null; end: number | null }[];
}) {
  const { driver, vs, set, summary, key } = useSelection();
  const { prefs } = usePreferences();
  const [view, setView] = useState<"2d" | "3d">("2d");
  const mapRef = useRef<HTMLDivElement>(null);
  const track3d = useCircuit3D(key, view === "3d");
  const onboard = useOnboard(key, driver);
  const [t, setT] = useState(data.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(10);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const emitted = useRef<number>(data.start);
  const scale = data.progress_scale;
  const styles = useMemo(() => seriesStyles(data.drivers), [data.drivers]);

  // Leader envelope: max progress at each frame (monotonic), for gaps.
  const leader = useMemo(() => {
    const out = new Float64Array(data.frames);
    for (const d of data.drivers) for (let i = 0; i < data.frames; i++) if (d.progress[i] > out[i]) out[i] = d.progress[i];
    for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1]);
    return out;
  }, [data]);

  const timeLeaderReached = useCallback(
    (p: number) => {
      let lo = 0;
      let hi = leader.length - 1;
      if (leader[hi] < p) return null;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (leader[mid] >= p) hi = mid;
        else lo = mid + 1;
      }
      if (lo === 0) return data.start;
      // Interpolate inside the frame for sub-second gaps.
      const prev = leader[lo - 1];
      const frac = leader[lo] > prev ? (p - prev) / (leader[lo] - prev) : 1;
      return data.start + (lo - 1 + frac) * data.step;
    },
    [leader, data.start, data.step],
  );

  // Animation loop (≈30 fps state updates).
  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (last.current == null) last.current = now;
      const dt = (now - last.current) / 1000;
      if (dt >= 1 / 30) {
        last.current = now;
        setT((prev) => {
          const next = prev + dt * speed;
          if (next >= data.end) {
            setPlaying(false);
            return data.end;
          }
          return next;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, speed, data.end]);

  // Race-control alerts as the clock passes each message.
  useEffect(() => {
    const from = emitted.current;
    if (t < from) {
      emitted.current = t; // scrubbed backwards: don't replay old alerts
      return;
    }
    if (!playing) {
      emitted.current = t;
      return;
    }
    const due = messages.filter((m) => m.session_time != null && m.session_time > from && m.session_time <= t);
    emitted.current = t;
    if (!prefs.alerts) return;
    due
      .filter((m) => SEVERITY_RANK[m.severity] >= SEVERITY_RANK[prefs.alertThreshold])
      .slice(-3)
      .forEach((m) => pushNotice({ kind: m.kind, severity: m.severity, title: m.title, message: m.message, lap: m.lap, source: "replay" }));
  }, [t, playing, messages, prefs.alerts, prefs.alertThreshold]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const f = Math.min(data.frames - 1, Math.max(0, (t - data.start) / data.step));
  const i0 = Math.floor(f);
  const i1 = Math.min(data.frames - 1, i0 + 1);
  const w = f - i0;
  const leaderNow = (leader[i0] * (1 - w) + leader[i1] * w) / scale;
  const totalLaps = data.total_laps ?? Math.ceil(leaderNow);
  const lap = Math.min(totalLaps, Math.floor(leaderNow) + 1);

  const cars: CarState[] = data.drivers
    .map((d) => {
      const p = (d.progress[i0] * (1 - w) + d.progress[i1] * w) / scale;
      const finished = t > d.finished_at;
      const reached = timeLeaderReached(p * scale);
      const stintLap = Math.floor(p) + 1;
      const stint = d.stints.find((s) => (s.start_lap ?? 0) <= stintLap && stintLap <= (s.end_lap ?? 999)) ?? d.stints[d.stints.length - 1];
      return {
        code: d.code,
        team: d.team,
        color: styles.get(d.code)?.color ?? "#999",
        dashed: !!styles.get(d.code)?.dashed,
        progress: p,
        grid: d.grid ?? 30,
        gap: reached != null ? t - reached : null,
        interval: null,
        inPit: d.pits.some((pit) => t >= pit.start && t <= (pit.end ?? pit.start + 30)),
        out: finished && d.retired,
        finished: finished && !d.retired,
        compound: stint?.compound ?? null,
      };
    })
    .sort((a, b) => Number(a.out) - Number(b.out) || b.progress - a.progress || a.grid - b.grid);
  cars.forEach((c, i) => {
    if (i > 0 && cars[i - 1].gap != null && c.gap != null) c.interval = c.gap - (cars[i - 1].gap as number);
  });

  const status = trackStatus.find((s) => s.start != null && s.end != null && t >= s.start && t < s.end)?.status ?? "1";
  const recent = messages.filter((m) => m.session_time != null && m.session_time <= t).slice(-8).reverse();

  const mapCars: TrackCar[] = cars
    .filter((c) => !c.out)
    .map((c) => ({
      code: c.code,
      color: c.color,
      // Before the start, line cars up in grid order behind the line (8 m slots).
      frac: c.progress <= 0.0005 ? 1 - (c.grid * 16 + 8) / (outline.length || 5000) : c.progress - Math.floor(c.progress),
      highlight: c.code === driver || c.code === vs,
      dim: c.inPit,
    }));

  const neutralSegments = trackStatus.filter((s) => s.status !== "1" && s.status !== "2" && s.start != null && s.end != null);
  const span = data.end - data.start;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Panel flush className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="display tnum text-2xl">
                Lap {Math.max(1, lap)}
                <span className="text-ink-3">/{totalLaps}</span>
              </span>
              <TrackStatusPill status={status} />
            </div>
            <span className="flex items-center gap-3">
              <Segmented
                size="sm"
                label="Map view"
                value={view}
                onChange={setView}
                options={[
                  { value: "2d", label: "2D" },
                  { value: "3d", label: "3D", title: "Real elevation, exaggerated ×4 · drag to orbit" },
                ]}
              />
              <span className="tnum text-sm text-ink-3">Session clock {clock(t)}</span>
              <ShareButton target={mapRef} title="Race replay" />
            </span>
          </div>
          <div
            ref={mapRef}
            className={cn("relative transition-shadow", status === "5" && "shadow-[inset_0_0_0_3px_#E5132B]", (status === "4" || status === "6") && "shadow-[inset_0_0_0_3px_#F59E0B]")}
          >
            {view === "3d" ? (
              track3d.data ? (
                <Track3D
                  track={track3d.data}
                  height={480}
                  ariaLabel={`3D replay at lap ${lap}; ${track3d.data.elevation_range} m of elevation change`}
                  cars={mapCars.map((c) => ({ code: c.code, color: c.color, frac: c.frac, highlight: c.highlight, dim: c.dim }))}
                />
              ) : track3d.error ? (
                <ErrorState error={track3d.error} className="h-[480px]" />
              ) : (
                <Loading label="Building the 3D circuit…" className="h-[480px]" />
              )
            ) : (
            <TrackMap
              outline={outline.outline}
              rotation={outline.rotation}
              corners={outline.corners}
              showCorners={false}
              cars={mapCars}
              sectorMarks={outline.sectors}
              height={480}
              ariaLabel={`Replay at lap ${lap}`}
            />
            )}
          </div>
          <div className="space-y-3 border-t border-line px-4 py-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-3">
                {neutralSegments.map((s, i) => (
                  <span
                    key={i}
                    className="absolute top-0 h-full"
                    style={{ left: `${(((s.start as number) - data.start) / span) * 100}%`, width: `${(((s.end as number) - (s.start as number)) / span) * 100}%`, background: TRACK_STATUS[s.status]?.color }}
                  />
                ))}
              </div>
              <input
                type="range"
                min={data.start}
                max={data.end}
                step={data.step}
                value={t}
                onChange={(e) => setT(Number(e.target.value))}
                aria-label="Replay position"
                className="relative w-full cursor-pointer appearance-none bg-transparent accent-[var(--team-primary)] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-team [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-surface"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="solid" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="w-24">
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button variant="outline" size="icon" aria-label="Restart" onClick={() => { setT(data.start); emitted.current = data.start; }}>
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next lap"
                onClick={() => {
                  const target = (Math.floor(leaderNow) + 1) * scale;
                  const reached = timeLeaderReached(target);
                  if (reached != null) setT(reached);
                }}
              >
                <SkipForward className="size-4" />
              </Button>
              <Segmented
                size="sm"
                label="Playback speed"
                value={String(speed)}
                onChange={(v) => setSpeed(Number(v) as (typeof SPEEDS)[number])}
                options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
              />
              <span className="ml-auto text-xs text-ink-3">Space to play or pause · alerts {prefs.alerts ? "on" : "off"}</span>
            </div>
          </div>
        </Panel>

        {driver && onboard.data && (
          <OnboardHud data={onboard.data} t={t} color={styles.get(onboard.data.driver.code)?.color ?? "var(--team-primary)"} />
        )}

        <Panel title="Race control" subtitle="Messages up to this point in the replay">
          {recent.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing from race control yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((m) => (
                <li key={m.id} className="flex items-start gap-3 text-[13px]">
                  <span className="tnum w-12 shrink-0 pt-0.5 text-xs text-ink-3">{m.lap ? `L${m.lap}` : "—"}</span>
                  <FlagChip kind={m.kind} label={m.title} />
                  <span className="text-ink-2">{m.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Timing" subtitle={summary?.session.kind === "race" ? "Gap to leader · interval" : "Order on track"} flush bodyClassName="pb-2">
        <ol className="divide-y divide-line/60">
          {cars.map((c, i) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => set({ driver: c.code })}
                className={cn(
                  "grid w-full grid-cols-[1.6rem_4px_2.8rem_1fr_auto_1.4rem] items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-surface-2",
                  c.code === driver && "bg-surface-3",
                  c.out && "opacity-45",
                )}
              >
                <span className="tnum text-right text-ink-3">{c.out ? "—" : i + 1}</span>
                <span className="h-4 rounded-full" style={{ background: c.color }} aria-hidden />
                <span className="font-bold">{c.code}</span>
                <span className="tnum truncate text-right text-ink-2">
                  {c.out ? "OUT" : c.inPit ? <span className="font-semibold text-warn">PIT</span> : i === 0 ? (c.finished ? "Finished" : `L${Math.floor(c.progress) + 1}`) : c.gap != null ? `+${c.gap.toFixed(1)}` : "—"}
                </span>
                <span className="tnum w-12 text-right text-xs text-ink-3">{i > 0 && c.interval != null && !c.out ? `+${c.interval.toFixed(1)}` : ""}</span>
                <Tyre compound={c.compound} size={15} />
              </button>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
