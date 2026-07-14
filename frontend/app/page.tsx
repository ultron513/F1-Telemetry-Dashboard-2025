"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

import DashboardGrid from "@/components/dashboard/DashboardGrid";
import EventSelector from "@/components/dashboard/EventSelector";
import SessionSelector from "@/components/dashboard/SessionSelector";
import DriverSelector from "@/components/dashboard/DriverSelector";
import KPICards from "@/components/dashboard/KPICards";
import QuickStats from "@/components/dashboard/QuickStats";
import { useDashboardWeather } from "@/hooks/useDashboardWeather";
import { useDashboardLap } from "@/hooks/useDashboardLap";
import LapSelector from "@/components/dashboard/LapSelector";
import { useLaps } from "@/hooks/useLaps";

import { useDashboard } from "@/hooks/useDashboard";
import { useDashboardTelemetry } from "@/hooks/useDashboardTelemetry";
import TelemetryPanel from "@/components/dashboard/TelemetryPanel";
import TrackMap from "@/components/charts/TrackMap";
import CompareDriverSelector from "@/components/dashboard/CompareDriverSelector";
import useCompareTelemetry from "@/hooks/useCompareTelemetry";
import useLapDelta from "@/hooks/useLapDelta";
import LapDeltaChart from "@/components/charts/LapDeltaChart";
import usePerformanceSummary from "@/hooks/usePerformanceSummary";
import PerformanceDashboard from "@/components/dashboard/PerformanceDashboard";
import useDriverPerformanceScore from "@/hooks/useDriverPerformanceScore";
import { useRaceControl } from "@/hooks/useRaceControl";
import RaceControlPanel from "@/components/dashboard/RaceControlPanel";
import { useTyreStrategy } from "@/hooks/useTyreStrategy";
import TyreStrategyCard from "@/components/dashboard/TyreStrategyCard";
import { usePitStops } from "@/hooks/usePitStops";
import PitStopsCard from "@/components/dashboard/PitStopsCard";
import DriverComparisonSummary from "@/components/dashboard/DriverComparisonSummary";
import { useTyreDegradation } from "@/hooks/useTyreDegradation";
import TyreDegradationChart from "@/components/dashboard/TyreDegradationChart";
import RaceEngineerInsights from "@/components/dashboard/RaceEngineerInsights";
import PaceEvolutionChart from "@/components/dashboard/PaceEvolutionChart";
import PaceStatisticsCard from "@/components/dashboard/PaceStatisticsCard";
import PaceRatingCard from "@/components/dashboard/PaceRatingCard";
import ConsistencyGauge from "@/components/dashboard/ConsistencyGauge";
import StintPerformanceCard from "@/components/dashboard/StintPerformanceCard";
import LapPaceDistribution from "@/components/dashboard/LapPaceDistribution";
import SessionTimeline from "@/components/dashboard/SessionTimeline";
import ExportRaceReportButton
from "@/components/dashboard/ExportRaceReportButton";
import RaceStrategyRecommendation from "@/components/dashboard/RaceStrategyRecommendation";
import { getRaceStrategyRecommendation } from "@/lib/raceStrategy";
import DriverFormCard from "@/components/dashboard/DriverFormCard";
import PerformanceVerdictCard from "@/components/dashboard/PerformanceVerdictCard";
import RaceHealthCard from "@/components/dashboard/RaceHealthCard";
export default function Home() {
  const dashboard = useDashboard();
  const weather = useDashboardWeather(
    dashboard.event,
    dashboard.session
  );
  const availableLaps = useLaps(
    dashboard.event,
    dashboard.session,
    dashboard.driver
  );

  const lap = useDashboardLap(
    dashboard.event,
    dashboard.session,
    dashboard.driver,
    Number(dashboard.lap)
  );

  const telemetry = useDashboardTelemetry(
    dashboard.event,
    dashboard.session,
    dashboard.driver,
    dashboard.lap
  );

  const compareTelemetry = useCompareTelemetry({
  event: dashboard.event,
  session: dashboard.session,
  driver: dashboard.compareDriver,
  lap: Number(dashboard.lap),
  });

  const performanceSummary = usePerformanceSummary({
    event: dashboard.event,
    session: dashboard.session,
    driver1: dashboard.driver,
    driver2: dashboard.compareDriver,
    lap: Number(dashboard.lap),
  });

  const performanceScore = useDriverPerformanceScore({
    event: dashboard.event,
    session: dashboard.session,
    driver1: dashboard.driver,
    driver2: dashboard.compareDriver,
    lap: Number(dashboard.lap),
  });

  const lapDelta = useLapDelta({
    event: dashboard.event,
    session: dashboard.session,
    driver1: dashboard.driver,
    driver2: dashboard.compareDriver,
    lap: Number(dashboard.lap),
  });

  const raceControl = useRaceControl(
    dashboard.event,
    dashboard.session
  );

  const tyreStrategy = useTyreStrategy(
    dashboard.event,
    dashboard.session,
    dashboard.driver
  );

  const pitStops = usePitStops(
    dashboard.event,
    dashboard.session,
    dashboard.driver
  );

  const tyreDegradation = useTyreDegradation(
    dashboard.event,
    dashboard.session,
    dashboard.driver
  );

  console.log({
  compareDriver: dashboard.compareDriver,
  lap: dashboard.lap,
  enabled:
    !!dashboard.event &&
    !!dashboard.session &&
    !!dashboard.compareDriver &&
    Number(dashboard.lap) > 0,
  compareTelemetry,
});

const exportRaceReport = () => {

  const report = {

    generatedAt: new Date().toISOString(),

    event: dashboard.event,

    session: dashboard.session,

    driver: dashboard.driver,

    compareDriver: dashboard.compareDriver,

    lap: dashboard.lap,

    quickStats: {

      lapTime: lap.data?.lap_time_seconds,

      topSpeed: lap.data?.max_speed,

      lapNumber: lap.data?.lap_number,

      trackTemperature:
        weather.data?.track_temperature,

      airTemperature:
        weather.data?.air_temperature,

      humidity:
        weather.data?.humidity,

      windSpeed:
        weather.data?.wind_speed,

    },

    performanceSummary:
      performanceSummary.data,

    performanceScores:
      performanceScore.data,

    raceControl:
      raceControl.data,

    tyreStrategy:
      tyreStrategy.data,

    pitStops:
      pitStops.data,

    tyreDegradation:
      tyreDegradation.data,

    strategyRecommendation: {
      status: strategy.status,
      action: strategy.action,
      risk: strategy.risk,
      confidence: strategy.confidence,
      degradation,
      consistency,
      suggestedPitWindow: strategy.pitWindow,
    },

  };

  const blob = new Blob(
    [
      JSON.stringify(
        report,
        null,
        2
      ),
    ],
    {
      type: "application/json",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download = `${dashboard.event.replaceAll(
    " ",
    "_"
  )}_${dashboard.driver}_Race_Report.json`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);

};

const degradationData =
  tyreDegradation.data?.laps ?? [];

const firstLap =
  degradationData[0]?.lap_time ?? 0;

const lastLap =
  degradationData[
    degradationData.length - 1
  ]?.lap_time ?? 0;

const degradation =
  lastLap - firstLap;

const average =
  degradationData.length
    ? degradationData.reduce(
        (
        sum: number,
        lap: any
        ) => sum + lap.lap_time,
        0
      ) / degradationData.length
    : 0;

const consistency =
  degradationData.length
    ? Math.sqrt(
        degradationData.reduce(
          (
              sum: number,
              lap: any
          ) =>
              sum +
              Math.pow(
                  lap.lap_time - average,
                  2
              ),
          0
        ) / degradationData.length
      )
    : 0;

const paceTrend = firstLap - lastLap;    

const lapsCompleted =
  degradationData.length;

const strategy = getRaceStrategyRecommendation(
  degradation,
  consistency,
  lapsCompleted
);  

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <div className="flex flex-wrap gap-4">

          <EventSelector
            races={dashboard.races.data?.races ?? []}
            value={dashboard.event}
            onChange={dashboard.setEvent}
          />

          <SessionSelector
            sessions={dashboard.sessions.data?.sessions ?? []}
            value={dashboard.session}
            onChange={dashboard.setSession}
          />

          <DriverSelector
            drivers={dashboard.drivers.data?.drivers ?? []}
            value={dashboard.driver}
            onChange={dashboard.setDriver}
          />
          <CompareDriverSelector
            drivers={
              (dashboard.drivers.data?.drivers ?? []).filter(
                (driver: { code: string }) => driver.code !== dashboard.driver
              )
            }
            value={dashboard.compareDriver}
            onChange={(value) => {
              console.log("Selected:", value);
              dashboard.setCompareDriver(value);
            }}
          />

          <LapSelector
            laps={availableLaps.data?.laps ?? []}
            value={dashboard.lap}
            onChange={dashboard.setLap}
          />

        </div>

        <div className="flex justify-end">
            <ExportRaceReportButton
                onExport={exportRaceReport}
            />
        </div>

        <KPICards
          items={[
            {
              title: "Track Temp",
              value:
                weather.data?.track_temperature != null
                  ? `${weather.data.track_temperature}°C`
                  : "--",
            },
            {
              title: "Air Temp",
              value:
                weather.data?.air_temperature != null
                  ? `${weather.data.air_temperature}°C`
                  : "--",
            },
            {
              title: "Humidity",
              value:
                weather.data?.humidity != null
                  ? `${weather.data.humidity}%`
                  : "--",
            },
            {
              title: "Wind Speed",
              value:
                weather.data?.wind_speed != null
                  ? `${weather.data.wind_speed} km/h`
                  : "--",
            },
          ]}
        />

        <DashboardGrid
          left={
            <>
              <TelemetryPanel
                telemetry={telemetry.data?.telemetry ?? []}
                 compareTelemetry={compareTelemetry.data?.telemetry ?? []}
              />

              <LapDeltaChart
                data={lapDelta.data ?? []}
              />

              <PerformanceDashboard
                  data={performanceSummary.data}
                  scores={performanceScore.data ?? []}
              />

              <DriverComparisonSummary
                  driver1={dashboard.driver}
                  driver2={dashboard.compareDriver}

                  lapTime1={performanceSummary.data?.sector_analysis?.[0]?.lap_time ?? 0}
                  lapTime2={performanceSummary.data?.sector_analysis?.[1]?.lap_time ?? 0}

                  topSpeed1={performanceSummary.data?.top_speed_analysis?.[0]?.top_speed ?? 0}
                  topSpeed2={performanceSummary.data?.top_speed_analysis?.[1]?.top_speed ?? 0}

                  sector1_1={performanceSummary.data?.sector_analysis?.[0]?.sector1 ?? null}
                  sector1_2={performanceSummary.data?.sector_analysis?.[1]?.sector1 ?? null}

                  sector2_1={performanceSummary.data?.sector_analysis?.[0]?.sector2 ?? null}
                  sector2_2={performanceSummary.data?.sector_analysis?.[1]?.sector2 ?? null}

                  sector3_1={performanceSummary.data?.sector_analysis?.[0]?.sector3 ?? null}
                  sector3_2={performanceSummary.data?.sector_analysis?.[1]?.sector3 ?? null}
              />

              <TyreDegradationChart
                data={tyreDegradation.data?.degradation ?? []}
              />

              <PaceEvolutionChart
                  data={tyreDegradation.data?.degradation ?? []}
              />

              <PaceStatisticsCard
                  data={tyreDegradation.data?.degradation ?? []}
              />

              <PaceRatingCard
                  data={tyreDegradation.data?.degradation ?? []}
              />

              <ConsistencyGauge
                  data={tyreDegradation.data?.degradation ?? []}
              />

              <StintPerformanceCard
                  data={tyreDegradation.data?.degradation ?? []}
              />

              <LapPaceDistribution
                  data={tyreDegradation.data?.degradation ?? []}
              />

              <RaceEngineerInsights
                data={tyreDegradation.data?.degradation ?? []}
              />

              <TrackMap
                data={telemetry.data?.telemetry ?? []}
              />
            </>
          }
          right={
            <>
              <QuickStats
                stats={[
                  {
                    label: "Selected Driver",
                    value: dashboard.driver || "---",
                  },
                  {
                    label: "Lap Time",
                    value:
                      lap.data?.lap_time_seconds != null
                        ? `${lap.data.lap_time_seconds.toFixed(3)} s`
                        : "---",
                  },
                  {
                    label: "Top Speed",
                    value:
                      lap.data?.max_speed != null
                        ? `${lap.data.max_speed.toFixed(1)} km/h`
                        : "---",
                  },
                  {
                    label: "Lap Number",
                    value: lap.data?.lap_number ?? "---",
                  },
                ]}
              />

              <RaceControlPanel
                messages={raceControl.data ?? []}
              />

              <SessionTimeline
                  messages={raceControl.data ?? []}
              />

              

              <RaceStrategyRecommendation
                  degradation={degradation}
                  consistency={consistency}
                  lapsCompleted={lapsCompleted}
              />

              <DriverFormCard
                trend={paceTrend}
              />

              <PerformanceVerdictCard
                  score={
                      performanceScore.data?.performance_score ?? 0
                  }
              />

              <RaceHealthCard
                  degradation={degradation}
                  consistency={consistency}
              />

              <TyreStrategyCard
                stints={tyreStrategy.data?.stints ?? []}
              />

              <PitStopsCard
                pitStops={pitStops.data?.pit_stops ?? []}
              />
            </>
          }
        />

      </div>
    </DashboardLayout>
  );
}