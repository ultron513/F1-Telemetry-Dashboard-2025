"use client";
import ComparisonCard from "./ComparisonCard";
import PerformanceSummary from "./PerformanceSummary";
import DriverPerformanceScoreCard from "./DriverPerformanceScoreCard";
import SectorWinnerCard from "./SectorWinnerCard";
interface DriverMetric {
  driver: string;
  [key: string]: any;
}
interface SectorAnalysis {
  driver: string;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  lap_time: number;
}
interface Props {
  data: any;
  scores: {
    driver: string;
    score: number;
  }[];
}

export default function PerformanceDashboard({
  data,
  scores,
}: Props) {
  if (!data) return null;
  
  const sector = data.sector_analysis as SectorAnalysis[];
  const topSpeed = data.top_speed_analysis as DriverMetric[];
  const acceleration = data.acceleration_analysis as DriverMetric[];
  const braking = data.braking_analysis as DriverMetric[];
  const drs = data.drs_analysis as DriverMetric[];
  const consistency = data.consistency_analysis as DriverMetric[];

  const left = sector[0];
  const right = sector[1];
  const lapTime1 = left.lap_time;
  const lapTime2 = right.lap_time;
  return (
  <div className="space-y-6">
    <DriverPerformanceScoreCard
      scores={scores}
    />

    <SectorWinnerCard
      sector1={left}
      sector2={right}
      sector3={left}
    />

    <PerformanceSummary
      driver1={left.driver}
      driver2={right.driver}
      lap1={1}
      lap2={1}
      lapTime1={lapTime1}
      lapTime2={lapTime2}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"></div>

        <ComparisonCard
        title="Sector 1"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={left.sector1}
        rightValue={right.sector1}
        unit=" s"
        higherIsBetter={false}
        />

        <ComparisonCard
        title="Sector 2"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={left.sector2}
        rightValue={right.sector2}
        unit=" s"
        higherIsBetter={false}
        />

        <ComparisonCard
        title="Sector 3"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={left.sector3}
        rightValue={right.sector3}
        unit=" s"
        higherIsBetter={false}
        />

        <ComparisonCard
        title="Top Speed"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={topSpeed[0]?.top_speed}
        rightValue={topSpeed[1]?.top_speed}
        unit=" km/h"
        />

        <ComparisonCard
        title="Acceleration"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={acceleration[0]?.maximum_acceleration}
        rightValue={acceleration[1]?.maximum_acceleration}
        unit=" m/s²"
        />

        <ComparisonCard
        title="Braking"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={braking[0]?.maximum_braking_speed}
        rightValue={braking[1]?.maximum_braking_speed}
        unit="km/h"
        higherIsBetter={false}
        />

        <ComparisonCard
        title="DRS Usage"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={drs[0]?.drs_percentage}
        rightValue={drs[1]?.drs_percentage}
        unit="%"
        />

        <ComparisonCard
        title="Consistency"
        leftDriver={left.driver}
        rightDriver={right.driver}
        leftValue={consistency[0]?.consistency_score}
        rightValue={consistency[1]?.consistency_score}
        unit="%"
        />

    </div>
  );
}