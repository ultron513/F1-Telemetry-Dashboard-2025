"use client";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function PaceStatisticsCard({
  data,
}: Props) {

  if (data.length === 0) {
    return null;
  }

  const lapTimes = data.map(
    (lap) => lap.lap_time
  );

  const average =
    lapTimes.reduce((a, b) => a + b, 0) /
    lapTimes.length;

  const best = Math.min(...lapTimes);

  const worst = Math.max(...lapTimes);

  const spread = worst - best;

  return (
    <DashboardCard title="Pace Statistics">

      <div className="grid grid-cols-2 gap-4">

        <div>
          <p className="text-zinc-400 text-sm">
            Average
          </p>

          <p className="text-xl font-bold">
            {average.toFixed(3)} s
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Best Lap
          </p>

          <p className="text-xl font-bold text-green-400">
            {best.toFixed(3)} s
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Worst Lap
          </p>

          <p className="text-xl font-bold text-red-400">
            {worst.toFixed(3)} s
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Pace Spread
          </p>

          <p className="text-xl font-bold">
            {spread.toFixed(3)} s
          </p>
        </div>

      </div>

    </DashboardCard>
  );
}