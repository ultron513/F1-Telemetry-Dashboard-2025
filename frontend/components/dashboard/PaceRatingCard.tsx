"use client";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function PaceRatingCard({
  data,
}: Props) {

  if (data.length < 2) {
    return null;
  }

  const lapTimes = data.map(
    (lap) => lap.lap_time
  );

  const best = Math.min(...lapTimes);
  const average =
    lapTimes.reduce((a, b) => a + b, 0) /
    lapTimes.length;

  const loss = average - best;

  let rating = 10;

  if (loss > 1.5) rating = 5;
  else if (loss > 1.0) rating = 6;
  else if (loss > 0.8) rating = 7;
  else if (loss > 0.5) rating = 8;
  else if (loss > 0.3) rating = 9;

  const colour =
    rating >= 9
      ? "text-green-400"
      : rating >= 7
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <DashboardCard title="Driver Pace Rating">

      <div className="flex flex-col items-center justify-center py-6">

        <div
          className={`text-6xl font-bold ${colour}`}
        >
          {rating}/10
        </div>

        <p className="mt-4 text-zinc-400">
          Average pace consistency
        </p>

      </div>

    </DashboardCard>
  );
}