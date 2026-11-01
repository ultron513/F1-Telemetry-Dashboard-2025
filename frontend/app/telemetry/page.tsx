"use client";

import { Download, ImageDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { TraceStack, type TraceChannel, type TraceSeries } from "@/components/charts/trace-stack";
import { TrackMap, type TrackMode } from "@/components/charts/track-map";
import { Tyre } from "@/components/f1/bits";
import { DriverAvatar } from "@/components/f1/driver-avatar";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { DriverPicker, LapPicker } from "@/components/shell/pickers";
import { Panel } from "@/components/ui/panel";
import { Button, Empty, ErrorState, Loading, Segmented, Stat } from "@/components/ui/primitives";
import { useCircuit, useCompare, useTelemetry } from "@/lib/api/queries";
import type { Channels, DriverInfo, LapMeta, TelemetryResponse } from "@/lib/api/types";
import { delta, lapTime, sectorTime, speed, speedUnitLabel, type SpeedUnit } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { downloadBlob, downloadSvgAsPng, toCsv } from "@/lib/utils";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";
import { hoverDistance, useStore } from "@/state/store";

export default function TelemetryPage() {
  return (
    <SessionGate>
      <Telemetry />
    </SessionGate>
  );
}

function toValues(ch: Channels, unit: SpeedUnit) {
  const k = unit === "mph" ? 0.621371 : 1;
  return {
    speed: ch.speed.map((v) => v * k),
    throttle: ch.throttle,
    brake: ch.brake,
    gear: ch.gear,
    rpm: ch.rpm,
    drs: ch.drs,
  };
}

function Telemetry() {
  const { key, driver, vs, lap, vsLap, set, focus, rival } = useSelection();
  const { prefs } = usePreferences();
  const circuit = useCircuit(key);
  const telA = useTelemetry(key, driver, lap);
  const telB = useTelemetry(key, vs, vsLap);
  const cmp = useCompare(key, driver, lap, vs, vsLap);
  const [mode, setMode] = useState<TrackMode>(vs ? "dominance" : "speed");
  const traceRef = useRef<SVGSVGElement>(null);
  const hover = useStore(hoverDistance);

  const colorA = teamColor(focus?.team, focus?.team_color);
  const sameTeam = !!rival && rival.team === focus?.team;
  const colorB = rival ? (sameTeam ? "var(--teammate)" : teamColor(rival.team, rival.team_color)) : "#888";

  const series: TraceSeries[] = useMemo(() => {
    if (vs && cmp.data) {
      return [
        { id: "a", label: cmp.data.a.driver.code, color: colorA, distance: cmp.data.distance, values: toValues(cmp.data.channels_a, prefs.speedUnit) },
        { id: "b", label: cmp.data.b.driver.code, color: colorB, dashed: sameTeam, distance: cmp.data.distance, values: toValues(cmp.data.channels_b, prefs.speedUnit) },
      ];
    }
    if (telA.data) {
      return [{ id: "a", label: telA.data.driver.code, color: colorA, distance: telA.data.channels.distance, values: toValues(telA.data.channels, prefs.speedUnit) }];
    }
    return [];
  }, [vs, cmp.data, telA.data, colorA, colorB, sameTeam, prefs.speedUnit]);

  const channels: TraceChannel[] = [
    { key: "speed", label: "Speed", unit: speedUnitLabel(prefs.speedUnit), height: 170 },
    { key: "throttle", label: "Throttle", unit: "%", height: 92, domain: [-5, 105], tickValues: [0, 50, 100] },
    { key: "brake", label: "Brake", height: 46, step: true, domain: [-0.15, 1.15], tickValues: [0, 1], format: (v) => (v >= 0.5 ? "On" : "Off") },
    { key: "gear", label: "Gear", height: 92, step: true, domain: [0.5, 8.5], tickValues: [2, 4, 6, 8] },
    { key: "rpm", label: "RPM", height: 92, format: (v) => `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` },
    { key: "drs", label: "DRS", height: 40, step: true, domain: [-0.2, 1.2], tickValues: [0, 1], format: (v) => (v >= 0.5 ? "Open" : "Shut") },
  ];

  const corners = useMemo(
    () =>
      (telA.data?.corners ?? []).map((c) => ({ label: `${c.number}${c.letter}`, distance: c.distance })),
    [telA.data],
  );

  const exportCsv = () => {
    const src = vs && cmp.data ? cmp.data : null;
    if (src) {
      downloadBlob(
        toCsv({
          distance_m: src.distance,
          [`${src.a.driver.code}_speed`]: src.channels_a.speed,
          [`${src.a.driver.code}_throttle`]: src.channels_a.throttle,
          [`${src.a.driver.code}_brake`]: src.channels_a.brake,
          [`${src.a.driver.code}_gear`]: src.channels_a.gear,
          [`${src.a.driver.code}_rpm`]: src.channels_a.rpm,
          [`${src.b.driver.code}_speed`]: src.channels_b.speed,
          [`${src.b.driver.code}_throttle`]: src.channels_b.throttle,
          [`${src.b.driver.code}_brake`]: src.channels_b.brake,
          [`${src.b.driver.code}_gear`]: src.channels_b.gear,
          [`${src.b.driver.code}_rpm`]: src.channels_b.rpm,
          delta_s: src.delta,
        }),
        `telemetry_${src.a.driver.code}_vs_${src.b.driver.code}.csv`,
        "text/csv",
      );
    } else if (telA.data) {
      const c = telA.data.channels;
      downloadBlob(
        toCsv({ distance_m: c.distance, time_s: c.time, speed_kmh: c.speed, throttle_pct: c.throttle, brake: c.brake, gear: c.gear, rpm: c.rpm, drs: c.drs, x: c.x, y: c.y }),
        `telemetry_${telA.data.driver.code}_lap${telA.data.lap.lap}.csv`,
        "text/csv",
      );
    }
  };

  const exportPng = () => {
    if (traceRef.current)
      downloadSvgAsPng(traceRef.current, `telemetry_${driver}${vs ? `_vs_${vs}` : ""}.png`, getComputedStyle(document.body).backgroundColor);
  };

  const loading = vs ? cmp.isLoading || telA.isLoading : telA.isLoading;
  const error = (vs ? cmp.error : null) ?? telA.error;

  const trackTraceA = vs && cmp.data ? { ...cmp.data.channels_a, distance: cmp.data.distance } : telA.data?.channels;
  const trackTraceB = vs && cmp.data ? { ...cmp.data.channels_b, distance: cmp.data.distance } : undefined;

  return (
    <>
      <PageHeader
        title="Telemetry"
        description="Every channel the car logged over a lap. Hover to read values and follow the car on the map; drag across the traces to zoom into a corner."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!telA.data}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" onClick={exportPng} disabled={!series.length}>
              <ImageDown className="size-4" /> PNG
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="flex gap-2">
          <DriverPicker caption="Driver" value={driver} onChange={(c) => c && set({ driver: c })} className="min-w-0 flex-1" />
          <LapPicker driver={driver} value={lap} onChange={(l) => set({ lap: l })} className="w-[150px]" />
        </div>
        <div className="flex gap-2">
          <DriverPicker caption="Compare with" value={vs} exclude={driver} allowNone onChange={(c) => { set({ vs: c }); if (c) setMode("dominance"); }} className="min-w-0 flex-1" />
          <LapPicker driver={vs} value={vsLap} onChange={(l) => set({ vslap: l })} caption="Their lap" className="w-[150px]" />
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <LapCard driver={focus} meta={telA.data?.lap} tel={telA.data} color={colorA} unit={prefs.speedUnit} />
        {rival ? <LapCard driver={rival} meta={telB.data?.lap} tel={telB.data} color={colorB} unit={prefs.speedUnit} /> : <ComparePrompt />}
        <GapCard />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel share
          accent
          title={vs ? "Overlay" : "Lap trace"}
          subtitle={hover != null ? `${Math.round(hover)} m into the lap` : "Hover for values · drag to zoom · double-click to reset"}
          bodyClassName="px-1 pb-3 sm:px-2"
        >
          {error && !series.length ? (
            <ErrorState error={error} />
          ) : loading && !series.length ? (
            <Loading label="Building the lap trace…" className="min-h-[600px]" />
          ) : (
            <TraceStack
              ref={traceRef}
              series={series}
              channels={channels}
              sectorMarks={(vs ? cmp.data?.sector_marks : telA.data?.sector_marks) ?? []}
              corners={corners}
              delta={
                vs && cmp.data
                  ? { distance: cmp.data.distance, values: cmp.data.delta, aColor: colorA, bColor: colorB, aLabel: cmp.data.a.driver.code, bLabel: cmp.data.b.driver.code }
                  : undefined
              }
            />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel share
            title="On track"
            actions={
              <Segmented
                size="sm"
                label="Map colouring"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "speed", label: "Speed" },
                  { value: "gear", label: "Gear" },
                  { value: "throttle", label: "Pedals" },
                  ...(vs ? [{ value: "dominance" as const, label: "Fastest" }] : []),
                ]}
              />
            }
            className="xl:sticky xl:top-[84px]"
          >
            {circuit.data && trackTraceA ? (
              <>
                <TrackMap
                  outline={circuit.data.outline}
                  rotation={circuit.data.rotation}
                  corners={circuit.data.corners}
                  mode={mode === "dominance" && !vs ? "speed" : mode}
                  trace={trackTraceA}
                  rampColor={colorA}
                  dominance={cmp.data?.minisectors}
                  dominanceColors={{ a: colorA, b: colorB }}
                  sectorMarks={circuit.data.sectors}
                  markers={
                    hover != null
                      ? [
                          { color: colorA, distance: hover, trace: trackTraceA, label: focus?.code },
                          ...(trackTraceB && rival ? [{ color: colorB, distance: hover, trace: trackTraceB, label: rival.code }] : []),
                        ]
                      : []
                  }
                  height={340}
                  ariaLabel="Lap on the circuit map, coloured by the selected channel"
                />
                <MapLegend mode={mode} vs={!!vs} a={focus?.code} b={rival?.code} colorA={colorA} colorB={colorB} />
              </>
            ) : (
              <Loading label="Drawing the circuit…" className="min-h-[340px]" />
            )}
          </Panel>

          <Insights tel={telA.data} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CornerTable a={telA.data} b={vs ? telB.data : undefined} unit={prefs.speedUnit} colorA={colorA} colorB={colorB} />
        <BrakingTable tel={telA.data} unit={prefs.speedUnit} />
      </div>
    </>
  );
}

function LapCard({ driver, meta, tel, color, unit }: { driver: DriverInfo | null; meta?: LapMeta; tel?: TelemetryResponse; color: string; unit: SpeedUnit }) {
  if (!driver) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-surface p-3" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
      <DriverAvatar code={driver.code} number={driver.number} team={driver.team} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">
            {driver.code} <span className="font-normal text-ink-3">{meta?.lap ? `lap ${meta.lap}` : ""}</span>
          </span>
          {meta && <Tyre compound={meta.compound} age={meta.tyre_life} size={16} />}
        </div>
        <div className="tnum text-2xl font-semibold">{lapTime(meta?.time)}</div>
        <div className="tnum mt-0.5 flex gap-3 text-xs text-ink-3">
          <span>S1 {sectorTime(meta?.s1)}</span>
          <span>S2 {sectorTime(meta?.s2)}</span>
          <span>S3 {sectorTime(meta?.s3)}</span>
          {tel && <span className="ml-auto">{speed(tel.stats.max_speed, unit)} {speedUnitLabel(unit)}</span>}
        </div>
      </div>
    </div>
  );
}

function ComparePrompt() {
  return (
    <div className="flex items-center rounded-lg border border-dashed border-line-strong px-4 text-[13px] text-ink-3">
      Pick a second driver to overlay their lap, see the running gap and who owns each part of the track.
    </div>
  );
}

function GapCard() {
  const { key, driver, vs, lap, vsLap } = useSelection();
  const cmp = useCompare(key, driver, lap, vs, vsLap);
  if (!vs) {
    return (
      <div className="rounded-lg border border-line bg-surface p-3 text-[13px] text-ink-3">
        <p className="font-semibold text-ink">Reading the traces</p>
        <p className="mt-1">Flat throttle on the straights, the brake trace marks each stop, and the gear trace shows how deep into the box the driver goes for every corner.</p>
      </div>
    );
  }
  const d = cmp.data;
  if (!d) return <div className="rounded-lg border border-line bg-surface p-3"><Loading className="min-h-16" label="Comparing laps…" /></div>;
  const ahead = (d.final_delta ?? 0) >= 0 ? d.a.driver.code : d.b.driver.code;
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-ink-3">Gap at the line</span>
        <span className="text-xs text-ink-3">
          Mini-sectors {d.a.driver.code} {d.dominance.a} · {d.b.driver.code} {d.dominance.b}
        </span>
      </div>
      <div className="tnum text-2xl font-semibold">
        {ahead} <span className="text-ink-2">by {Math.abs(d.final_delta ?? 0).toFixed(3)}s</span>
      </div>
      <div className="tnum mt-1 flex gap-3 text-xs">
        {d.sectors.map((s) => (
          <span key={s.sector} className="text-ink-3">
            {s.sector}{" "}
            <span style={{ color: s.delta == null ? undefined : s.delta > 0 ? "var(--good)" : "var(--bad)" }}>{delta(s.delta)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MapLegend({ mode, vs, a, b, colorA, colorB }: { mode: TrackMode; vs: boolean; a?: string; b?: string; colorA: string; colorB: string }) {
  if (mode === "dominance" && vs)
    return (
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded" style={{ background: colorA }} /> {a} faster</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded" style={{ background: colorB }} /> {b} faster</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded bg-[#7A8392]" /> Even</span>
      </div>
    );
  if (mode === "throttle")
    return (
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded" style={{ background: colorA }} /> Full throttle</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded bg-[#FF4D5E]" /> Braking</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded bg-[#7A8392]" /> Partial / coasting</span>
      </div>
    );
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
      <span>{mode === "gear" ? "1st" : "Slow"}</span>
      <span className="h-1.5 w-32 rounded" style={{ background: `linear-gradient(90deg, #2B313C, ${colorA} 55%, #F4F6F8)` }} />
      <span>{mode === "gear" ? "8th" : "Fast"}</span>
    </div>
  );
}

function Insights({ tel }: { tel?: TelemetryResponse }) {
  const { prefs } = usePreferences();
  if (!tel) return null;
  const s = tel.stats;
  return (
    <Panel title="Engineer's notes" subtitle={`${tel.driver.code}, lap ${tel.lap.lap}`}>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Top speed" value={speed(s.max_speed, prefs.speedUnit)} unit={speedUnitLabel(prefs.speedUnit)} />
        <Stat label="Full throttle" value={`${s.full_throttle_pct?.toFixed(0) ?? "—"}%`} />
        <Stat label="On the brakes" value={`${s.braking_pct?.toFixed(0) ?? "—"}%`} />
        <Stat label="Average" value={speed(s.avg_speed, prefs.speedUnit)} unit={speedUnitLabel(prefs.speedUnit)} />
        <Stat label="Gear changes" value={s.gear_changes} />
        <Stat label="Coasting" value={`${s.coasting_pct?.toFixed(0) ?? "—"}%`} />
      </div>
      <ul className="space-y-2 border-t border-line pt-3">
        {tel.insights.map((i) => (
          <li key={i.title} className="text-[13px] leading-snug">
            <span className="font-semibold text-ink">{i.title}.</span> <span className="text-ink-2">{i.text}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CornerTable({ a, b, unit, colorA, colorB }: { a?: TelemetryResponse; b?: TelemetryResponse; unit: SpeedUnit; colorA: string; colorB: string }) {
  if (!a) return null;
  const bMap = new Map((b?.corners ?? []).map((c) => [`${c.number}${c.letter}`, c]));
  return (
    <Panel share title="Corner minimum speeds" subtitle={b ? "Apex speed and gear, with the difference" : "Apex speed and gear"} flush bodyClassName="px-3 pb-3">
      {a.corners.length === 0 ? (
        <Empty>No corner data for this circuit.</Empty>
      ) : (
        <div className="scroll-thin max-h-[360px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-1.5 pl-1 font-medium">Turn</th>
                <th className="py-1.5 text-right font-medium" style={{ color: colorA }}>{a.driver.code}</th>
                {b && <th className="py-1.5 text-right font-medium" style={{ color: colorB }}>{b.driver.code}</th>}
                {b && <th className="py-1.5 pr-1 text-right font-medium">Δ {speedUnitLabel(unit)}</th>}
              </tr>
            </thead>
            <tbody>
              {a.corners.map((c) => {
                const k = `${c.number}${c.letter}`;
                const o = bMap.get(k);
                const diff = o ? (c.min_speed - o.min_speed) * (unit === "mph" ? 0.621371 : 1) : null;
                return (
                  <tr key={k} className="border-b border-line/50 last:border-0">
                    <td className="py-1.5 pl-1 font-semibold">T{k}</td>
                    <td className="tnum py-1.5 text-right">
                      {speed(c.min_speed, unit)} <span className="text-ink-3">G{c.gear}</span>
                    </td>
                    {b && (
                      <td className="tnum py-1.5 text-right">
                        {o ? <>{speed(o.min_speed, unit)} <span className="text-ink-3">G{o.gear}</span></> : "—"}
                      </td>
                    )}
                    {b && (
                      <td className="tnum py-1.5 pr-1 text-right" style={{ color: diff == null ? undefined : diff > 0.5 ? colorA : diff < -0.5 ? colorB : "var(--ink-3)" }}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(0)}`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function BrakingTable({ tel, unit }: { tel?: TelemetryResponse; unit: SpeedUnit }) {
  if (!tel) return null;
  const zones = [...tel.braking_zones].sort((x, y) => y.speed_drop - x.speed_drop).slice(0, 10);
  return (
    <Panel title="Biggest stops" subtitle={`${tel.driver.code}'s heaviest braking zones on this lap`} flush bodyClassName="px-3 pb-3">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="py-1.5 pl-1 font-medium">From</th>
            <th className="py-1.5 text-right font-medium">Entry</th>
            <th className="py-1.5 text-right font-medium">Min</th>
            <th className="py-1.5 text-right font-medium">Shed</th>
            <th className="py-1.5 pr-1 text-right font-medium">Avg decel</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.start} className="cursor-default border-b border-line/50 last:border-0 hover:bg-surface-2" onPointerEnter={() => hoverDistance.set(z.start)} onPointerLeave={() => hoverDistance.set(null)}>
              <td className="tnum py-1.5 pl-1 text-ink-2">{Math.round(z.start)} m</td>
              <td className="tnum py-1.5 text-right">{speed(z.entry_speed, unit)}</td>
              <td className="tnum py-1.5 text-right">{speed(z.min_speed, unit)}</td>
              <td className="tnum py-1.5 text-right">−{speed(z.speed_drop, unit)}</td>
              <td className="tnum py-1.5 pr-1 text-right">{z.decel_g.toFixed(1)} g</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
