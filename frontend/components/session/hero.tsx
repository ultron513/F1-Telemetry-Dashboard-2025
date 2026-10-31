"use client";

import { DriverAvatar } from "@/components/f1/driver-avatar";
import { TrackMap } from "@/components/charts/track-map";
import { useCircuit } from "@/lib/api/queries";
import type { SessionSummary } from "@/lib/api/types";
import { SESSION_LABEL } from "@/lib/f1";
import { countryFlagEmoji, lapTime, shortDate } from "@/lib/format";
import { teamTheme } from "@/lib/teams";
import { useSelection } from "@/state/selection";

/** Session hero: the event name set large over the focused team's livery band. */
export function SessionHero({ summary }: { summary: SessionSummary }) {
  const { key, focus, set } = useSelection();
  const circuit = useCircuit(key);
  const { event, highlights, results } = summary;
  const lead = results[0];
  const kind = summary.session.kind;
  const headline = focus ?? summary.drivers.find((d) => d.code === lead?.code) ?? null;
  const headlineResult = results.find((r) => r.code === headline?.code);
  const theme = teamTheme(headline?.team);

  const stats: { label: string; value: string }[] = [
    { label: kind === "race" ? "Laps" : "Timed laps", value: String(kind === "race" ? (highlights.total_laps ?? "—") : highlights.timed_laps) },
    {
      label: "Fastest lap",
      value: highlights.fastest_lap ? `${highlights.fastest_lap.driver} ${lapTime(highlights.fastest_lap.time)}` : "—",
    },
    { label: "Pit stops", value: String(highlights.pit_stops) },
  ];
  if (kind === "race") {
    stats.push({ label: "Places gained & lost", value: String(highlights.position_changes ?? "—") });
    stats.push({
      label: "Neutralisations",
      value:
        highlights.safety_car + highlights.vsc + highlights.red_flag === 0
          ? "None"
          : [highlights.safety_car && `${highlights.safety_car} SC`, highlights.vsc && `${highlights.vsc} VSC`, highlights.red_flag && `${highlights.red_flag} red`]
              .filter(Boolean)
              .join(", "),
    });
  }

  return (
    <section className="team-transition relative isolate overflow-hidden rounded-xl border border-line bg-team-deep text-white">
      <div className="livery absolute inset-0 -z-10 opacity-95" aria-hidden />
      <div className="carbon absolute inset-0 -z-10" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/35 to-transparent" aria-hidden />

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          <p className="text-[13px] text-white/75">
            <span aria-hidden>{countryFlagEmoji(event.country)} </span>
            Round {event.round} · {event.location} · {shortDate(event.date)}
          </p>
          <h1 className="display mt-2 text-[40px] leading-[0.95] text-balance sm:text-[56px] xl:text-[68px]">
            {event.name}
          </h1>
          <p className="mt-2 text-lg font-semibold italic text-white/85">
            {SESSION_LABEL[summary.session.code]} {summary.season}
          </p>

          {headline && (
            <button
              type="button"
              onClick={() => set({ driver: headline.code })}
              className="mt-6 flex max-w-full items-center gap-4 rounded-lg bg-black/35 p-2.5 pr-5 text-left backdrop-blur-sm"
            >
              <DriverAvatar code={headline.code} number={headline.number} team={headline.team} size="md" />
              <span className="min-w-0">
                <span className="block text-xs text-white/70">
                  {headlineResult?.position === 1
                    ? kind === "race"
                      ? "Winner"
                      : "Fastest"
                    : `Focus driver · P${headlineResult?.position ?? "—"}`}
                </span>
                <span className="block truncate text-xl font-bold italic">{headline.full_name}</span>
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <span className="inline-block h-3 w-1 rounded-full" style={{ background: theme.secondary }} aria-hidden />
                  {headline.team}
                  {headlineResult?.time_text && <span className="tnum text-white">· {headlineResult.time_text}</span>}
                </span>
              </span>
            </button>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-white/65">{s.label}</dt>
                <dd className="tnum mt-0.5 truncate text-[15px] font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hidden min-h-[240px] lg:block">
          {circuit.data && (
            <div className="rounded-lg bg-black/30 p-2 backdrop-blur-sm [--ink-2:rgba(255,255,255,0.75)] [--ink-3:rgba(255,255,255,0.75)] [--line-strong:rgba(255,255,255,0.25)] [--surface-3:rgba(255,255,255,0.12)] [--surface:#0d0f13] [--ink:#fff] [--bg:#0d0f13]">
              <TrackMap
                outline={circuit.data.outline}
                rotation={circuit.data.rotation}
                corners={circuit.data.corners}
                height={250}
                showCorners={false}
                ariaLabel={`${event.location} circuit outline`}
              />
              <p className="tnum px-2 pb-1 text-xs text-white/70">
                {(circuit.data.length / 1000).toFixed(3)} km · {circuit.data.corners.length} corners
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
