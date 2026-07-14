"use client";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function ConsistencyGauge({
  data,
}: Props) {

  if (data.length < 2) return null;

  const lapTimes = data.map(
    lap => lap.lap_time
  );

  const average =
    lapTimes.reduce((a,b)=>a+b,0) /
    lapTimes.length;

  const deviation =
    Math.sqrt(
      lapTimes.reduce(
        (sum,value)=>
          sum + Math.pow(value-average,2),
        0
      ) / lapTimes.length
    );

  let score = 100 - deviation * 30;

  score = Math.max(
    0,
    Math.min(
      100,
      score
    )
  );

  const colour =
    score >= 90
      ? "bg-green-500"
      : score >= 75
      ? "bg-yellow-500"
      : "bg-red-500";

  return (

    <DashboardCard title="Driver Consistency">

      <div className="space-y-5">

        <div className="w-full rounded-full bg-zinc-800 h-5">

          <div
            className={`${colour} h-5 rounded-full transition-all`}
            style={{
              width: `${score}%`
            }}
          />

        </div>

        <div className="flex justify-between">

          <span>Consistency</span>

          <span className="font-bold">
            {score.toFixed(1)}%
          </span>

        </div>

      </div>

    </DashboardCard>

  );
}