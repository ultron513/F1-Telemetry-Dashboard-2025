"use client";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function StintPerformanceCard({
  data,
}: Props) {

  if (data.length === 0) {
    return null;
  }

  const firstLap = data[0].lap;
  const lastLap = data[data.length - 1].lap;

  const firstTime = data[0].lap_time;
  const lastTime = data[data.length - 1].lap_time;

  const average =
    data.reduce(
      (sum, lap) => sum + lap.lap_time,
      0
    ) / data.length;

  const trend = lastTime - firstTime;

  return (
    <DashboardCard title="Stint Performance">

      <div className="space-y-4">

        <div className="flex justify-between">
          <span className="text-zinc-400">
            Stint
          </span>

          <span className="font-semibold">
            Lap {firstLap} – {lastLap}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">
            Average Pace
          </span>

          <span className="font-semibold">
            {average.toFixed(3)} s
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">
            Pace Trend
          </span>

          <span
            className={`font-semibold ${
              trend <= 0
                ? "text-green-400"
                : "text-yellow-400"
            }`}
          >
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(3)} s
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">
            Laps Analysed
          </span>

          <span className="font-semibold">
            {data.length}
          </span>
        </div>

      </div>

    </DashboardCard>
  );
}