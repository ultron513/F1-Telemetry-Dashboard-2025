"use client";

import { CloudRain, Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { LegendSwatch } from "@/components/charts/core";
import { LineChart } from "@/components/charts/line-chart";
import { WindRose } from "@/components/charts/misc-charts";
import { PageHeader, SessionGate } from "@/components/shell/page";
import { Panel } from "@/components/ui/panel";
import { Empty, QueryView } from "@/components/ui/primitives";
import { useWeather } from "@/lib/api/queries";
import type { WeatherResponse } from "@/lib/api/types";
import { temp, tempUnitLabel } from "@/lib/format";
import { usePreferences } from "@/state/preferences";
import { useSelection } from "@/state/selection";
import { useTeamTheme } from "@/state/team-theme";

export default function WeatherPage() {
  return (
    <SessionGate>
      <Weather />
    </SessionGate>
  );
}

function Weather() {
  const { key } = useSelection();
  const weather = useWeather(key);
  return (
    <>
      <PageHeader title="Weather" description="Conditions logged by the circuit's weather station once a minute through the session." />
      <QueryView query={weather}>{(w) => (w.series && w.summary ? <WeatherBody w={w} /> : <Empty>No weather data was published for this session.</Empty>)}</QueryView>
    </>
  );
}

function WeatherBody({ w }: { w: WeatherResponse }) {
  const { prefs } = usePreferences();
  const theme = useTeamTheme();
  const s = w.summary!;
  const series = w.series!;
  const tu = tempUnitLabel(prefs.tempUnit);
  const conv = (v: number | null) => (v == null ? null : prefs.tempUnit === "f" ? v * 1.8 + 32 : v);
  const rainBands = w.rain_windows.map((r) => ({ from: r.start, to: r.end, color: "#2E7BFF", label: "Rain" }));
  const xf = (v: number) => `${Math.round(v)}′`;

  const tiles = [
    { icon: Thermometer, label: "Track", value: `${temp(s.track_temp.mean, prefs.tempUnit)}${tu}`, sub: `${temp(s.track_temp.min, prefs.tempUnit, 0)}–${temp(s.track_temp.max, prefs.tempUnit, 0)}${tu}` },
    { icon: Thermometer, label: "Air", value: `${temp(s.air_temp.mean, prefs.tempUnit)}${tu}`, sub: `${temp(s.air_temp.min, prefs.tempUnit, 0)}–${temp(s.air_temp.max, prefs.tempUnit, 0)}${tu}` },
    { icon: Droplets, label: "Humidity", value: `${s.humidity.mean?.toFixed(0)}%`, sub: `${s.humidity.min?.toFixed(0)}–${s.humidity.max?.toFixed(0)}%` },
    { icon: Wind, label: "Wind", value: `${s.wind_speed.mean?.toFixed(1)} m/s`, sub: `gusts to ${s.wind_speed.max?.toFixed(1)} m/s` },
    { icon: Gauge, label: "Pressure", value: `${s.pressure.mean?.toFixed(0)} mbar`, sub: `${s.pressure.min?.toFixed(0)}–${s.pressure.max?.toFixed(0)}` },
    { icon: CloudRain, label: "Rain", value: s.rain_share ? `${s.rain_share.toFixed(0)}%` : "Dry", sub: s.rain_share ? "of samples wet" : "no rainfall logged" },
  ];

  const trackDelta = (s.track_temp.end ?? 0) - (s.track_temp.start ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-line bg-surface p-3.5">
            <div className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <t.icon className="size-4" aria-hidden /> {t.label}
            </div>
            <div className="tnum mt-1 text-xl font-semibold">{t.value}</div>
            <div className="tnum text-xs text-ink-3">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          accent
          title="Temperatures"
          subtitle={`Track ${trackDelta >= 0 ? "warmed" : "cooled"} by ${Math.abs(prefs.tempUnit === "f" ? trackDelta * 1.8 : trackDelta).toFixed(1)}${tu} from start to finish`}
          actions={
            <span className="flex gap-3">
              <LegendSwatch color={theme.primary} label="Track" />
              <LegendSwatch color="var(--ink-2)" dashed label="Air" />
            </span>
          }
        >
          <LineChart
            series={[
              { id: "track", label: "Track", color: theme.primary, width: 2.2, points: series.minute.map((m, i) => ({ x: m, y: conv(series.track_temp[i]) })) },
              { id: "air", label: "Air", color: "#A3ACB9", dashed: true, points: series.minute.map((m, i) => ({ x: m, y: conv(series.air_temp[i]) })) },
            ]}
            height={300}
            xFormat={xf}
            tooltipX={(v) => `${Math.round(v)} min into session`}
            yFormat={(v) => `${v.toFixed(0)}°`}
            bands={rainBands}
            xLabel="minutes"
            ariaLabel="Track and air temperature over the session"
          />
        </Panel>
        <Panel title="Wind direction" subtitle="Share of samples by direction; darker = stronger">
          <WindRose data={w.wind_rose} color={theme.primary} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { key: "humidity", title: "Humidity", unit: "%", data: series.humidity, f: (v: number) => `${v.toFixed(0)}%` },
          { key: "wind", title: "Wind speed", unit: "m/s", data: series.wind_speed, f: (v: number) => v.toFixed(1) },
          { key: "pressure", title: "Pressure", unit: "mbar", data: series.pressure, f: (v: number) => v.toFixed(0) },
        ].map((c) => (
          <Panel key={c.key} title={c.title} subtitle={c.unit}>
            <LineChart
              series={[{ id: c.key, label: c.title, color: theme.primary, points: series.minute.map((m, i) => ({ x: m, y: c.data[i] })) }]}
              height={180}
              xFormat={xf}
              tooltipX={(v) => `${Math.round(v)} min`}
              yFormat={c.f}
              bands={rainBands}
              ariaLabel={`${c.title} over the session`}
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}
