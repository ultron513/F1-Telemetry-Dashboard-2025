"use client";

import { ImageDown } from "lucide-react";
import { useRef, useState } from "react";

import { TrackMap, type TrackMode } from "@/components/charts/track-map";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { DriverPicker, LapPicker } from "@/components/shell/pickers";
import { Panel } from "@/components/ui/panel";
import { Button, Loading, Segmented, Stat } from "@/components/ui/primitives";
import { useCircuit, useCompare, useTelemetry } from "@/lib/api/queries";
import { lapTime, speed, speedUnitLabel } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { downloadSvgAsPng } from "@/lib/utils";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";
import { hoverDistance, useStore } from "@/state/store";

export default function TrackMapPage() {
  return (
    <SessionGate>
      <TrackMapView />
    </SessionGate>
  );
}

function TrackMapView() {
  const { key, driver, vs, lap, vsLap, set, focus, rival, event } = useSelection();
  const { prefs } = usePreferences();
  const circuit = useCircuit(key);
  const tel = useTelemetry(key, driver, lap);
  const cmp = useCompare(key, driver, lap, vs, vsLap);
  const [mode, setMode] = useState<TrackMode | "drs">("speed");
  const [corners, setCorners] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const hover = useStore(hoverDistance);

  const colorA = teamColor(focus?.team, focus?.team_color);
  const colorB = rival ? (rival.team === focus?.team ? "var(--teammate)" : teamColor(rival.team, rival.team_color)) : "#888";
  const c = circuit.data;
  const sectorLengths = c
    ? [c.sectors[0] ?? null, c.sectors[1] != null && c.sectors[0] != null ? c.sectors[1] - c.sectors[0] : null, c.sectors[1] != null ? c.length - c.sectors[1] : null]
    : [];

  const mapMode: TrackMode = mode === "drs" ? "plain" : mode === "dominance" && !cmp.data ? "speed" : mode;

  return (
    <>
      <PageHeader
        title="Track map"
        description="The lap drawn on the circuit. Colour it by speed, gear or pedal use, or by who was quicker through each mini-sector."
        actions={
          <Button
            variant="outline"
            onClick={() => svgRef.current && downloadSvgAsPng(svgRef.current, `${event?.location ?? "track"}_${mode}.png`, getComputedStyle(document.body).backgroundColor)}
          >
            <ImageDown className="size-4" /> PNG
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DriverPicker caption="Driver" value={driver} onChange={(d) => d && set({ driver: d })} className="w-[220px]" />
        <LapPicker driver={driver} value={lap} onChange={(l) => set({ lap: l })} className="w-[150px]" />
        <DriverPicker caption="Compare with" value={vs} exclude={driver} allowNone onChange={(d) => set({ vs: d })} className="w-[220px]" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          accent
          title={event?.location ?? "Circuit"}
          subtitle={c ? `${(c.length / 1000).toFixed(3)} km · ${c.corners.length} corners${c.corner_source === "detected" ? " (detected from speed)" : ""}` : undefined}
          actions={
            <>
              <Segmented
                size="sm"
                label="Colour by"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "speed", label: "Speed" },
                  { value: "gear", label: "Gear" },
                  { value: "throttle", label: "Pedals" },
                  { value: "dominance", label: "Fastest" },
                  { value: "drs", label: "DRS zones" },
                ]}
              />
              <Button size="sm" variant="outline" onClick={() => setCorners((v) => !v)} aria-pressed={corners}>
                {corners ? "Hide" : "Show"} corners
              </Button>
            </>
          }
        >
          {c && tel.data ? (
            <TrackMap
              ref={svgRef}
              outline={c.outline}
              rotation={c.rotation}
              corners={c.corners}
              showCorners={corners}
              mode={mapMode}
              trace={tel.data.channels}
              rampColor={colorA}
              dominance={cmp.data?.minisectors}
              dominanceColors={{ a: colorA, b: colorB }}
              sectorMarks={c.sectors}
              drsZones={mode === "drs" ? c.drs_zones : []}
              markers={hover != null ? [{ color: colorA, distance: hover, trace: tel.data.channels, label: focus?.code }] : []}
              height={560}
              ariaLabel={`${event?.location} circuit coloured by ${mode}`}
            />
          ) : (
            <Loading label="Drawing the circuit…" className="min-h-[560px]" />
          )}
          {mode === "dominance" && !vs && <p className="mt-2 text-sm text-ink-3">Pick a driver to compare with to see who owns each mini-sector.</p>}
          {mode === "drs" && c && c.drs_zones.length === 0 && <p className="mt-2 text-sm text-ink-3">No DRS use was recorded in this session.</p>}
        </Panel>

        <div className="space-y-4">
          <Panel title="Circuit">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Lap length" value={c ? (c.length / 1000).toFixed(3) : "—"} unit="km" />
              <Stat label="Corners" value={c?.corners.length ?? "—"} />
              <Stat label="DRS zones" value={c?.drs_zones.length ?? "—"} />
              <Stat label="Reference lap" value={lapTime(c?.reference.time)} sub={c?.reference.driver ? `${c.reference.driver}, lap ${c.reference.lap}` : undefined} />
            </div>
            {sectorLengths.length === 3 && (
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-1.5 text-[12.5px] text-ink-3">Sector lengths</div>
                <div className="flex h-2 overflow-hidden rounded-full">
                  {sectorLengths.map((s, i) => (
                    <span key={i} style={{ width: `${((s ?? 0) / (c?.length || 1)) * 100}%`, background: ["var(--team-primary)", "var(--team-secondary)", "var(--team-tertiary)"][i] }} className="border-r-2 border-surface last:border-0" />
                  ))}
                </div>
                <div className="tnum mt-1.5 flex justify-between text-xs text-ink-2">
                  {sectorLengths.map((s, i) => (
                    <span key={i}>S{i + 1} {s != null ? `${(s / 1000).toFixed(2)} km` : "—"}</span>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Corners" subtitle={tel.data ? `${tel.data.driver.code}'s minimum speed, lap ${tel.data.lap.lap}` : undefined} flush bodyClassName="px-3 pb-3">
            <ul className="scroll-thin max-h-[380px] space-y-1 overflow-y-auto">
              {(tel.data?.corners ?? []).map((cn) => {
                const maxSp = tel.data?.stats.max_speed ?? 330;
                return (
                  <li
                    key={`${cn.number}${cn.letter}`}
                    className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-surface-2"
                    onPointerEnter={() => hoverDistance.set(cn.distance)}
                    onPointerLeave={() => hoverDistance.set(null)}
                  >
                    <span className="font-semibold">T{cn.number}{cn.letter}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-team" style={{ width: `${(cn.min_speed / maxSp) * 100}%` }} />
                    </span>
                    <span className="tnum text-right">
                      {speed(cn.min_speed, prefs.speedUnit)} <span className="text-[11px] text-ink-3">{speedUnitLabel(prefs.speedUnit)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
