"use client";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function RaceEngineerInsights({
  data,
}: Props) {
  if (data.length < 2) {
    return null;
  }

  const lapTimes = data.map(
    (lap) => lap.lap_time
  );

  const first = lapTimes[0];

  const last = lapTimes[
    lapTimes.length - 1
  ];

  const degradation = last - first;

  const average =
    lapTimes.reduce(
      (sum, value) => sum + value,
      0
    ) / lapTimes.length;

  const bestLap =
    Math.min(...lapTimes);

  const bestLapNumber =
    data.find(
      (lap) => lap.lap_time === bestLap
    )?.lap ?? "-";

  const worstLap =
    Math.max(...lapTimes);

  const paceSpread =
    worstLap - bestLap;

  const consistency =
    Math.sqrt(
      lapTimes.reduce(
        (sum, value) =>
          sum +
          Math.pow(
            value - average,
            2
          ),
        0
      ) / lapTimes.length
    );

  const insights: {
    text: string;
    type: "good" | "warning" | "action";
  }[] = [];

  let summary = "";

if (degradation < 0.7 && consistency < 0.35) {
  summary =
    "Overall stint performance remained stable with controlled tyre degradation and consistent pace. Current strategy can be maintained.";
}
else if (degradation < 1.5) {
  summary =
    "Tyre performance is beginning to decline, but the current strategy remains viable. Continue monitoring lap time trends.";
}
else {
  summary =
    "Performance has deteriorated significantly. An earlier pit stop should be considered to prevent further pace loss.";
}

  /* Tyre degradation */

  if (degradation < 0.7) {
    insights.push({
      text: "Tyre degradation remained LOW throughout the analysed stint.",
      type: "good",
    });
  } else if (degradation < 1.5) {
    insights.push({
      text: "Tyre degradation is increasing. Monitor tyre performance closely.",
      type: "warning",
    });
  } else {
    insights.push({
      text: "High tyre degradation detected. Pit stop should be considered.",
      type: "action",
    });
  }

  /* Pace consistency */

  if (consistency < 0.35) {
    insights.push({
      text: "Driver maintained excellent pace consistency.",
      type: "good",
    });
  } else if (consistency < 0.7) {
    insights.push({
      text: "Pace consistency is acceptable with minor variation.",
      type: "warning",
    });
  } else {
    insights.push({
      text: "Large pace variation detected across the stint.",
      type: "action",
    });
  }

  /* Pace spread */

  if (paceSpread < 0.8) {
    insights.push({
      text: `Lap pace spread remained low (${paceSpread.toFixed(3)} s).`,
      type: "good",
    });
  } else {
    insights.push({
      text: `Lap pace spread reached ${paceSpread.toFixed(3)} s.`,
      type: "warning",
    });
  }

  /* Best lap */

  insights.push({
    text: `Best lap recorded on Lap ${bestLapNumber}.`,
    type: "good",
  });

  /* Average pace */

  insights.push({
    text: `Average lap pace was ${average.toFixed(3)} s.`,
    type: "good",
  });

    let status = "LOW";
    let colour = "text-green-400";

    if (degradation > 1.5) {
    status = "HIGH";
    colour = "text-red-400";
    } else if (degradation > 0.7) {
    status = "MEDIUM";
    colour = "text-yellow-400";
    }

  return (
    <DashboardCard title="Race Engineer Insights">
      <div className="space-y-4">

      <div className="border-b border-zinc-800 pb-4">

        <p className="text-lg font-bold">
          Engineering Briefing
        </p>

        <p className="text-sm text-zinc-400">
          Automated analysis based on current stint data
        </p>

      </div>

      {insights.map((item, index) => {

        const colour =
          item.type === "good"
            ? "text-green-400"
            : item.type === "warning"
            ? "text-yellow-400"
            : "text-red-400";

        const icon =
          item.type === "good"
            ? "✓"
            : item.type === "warning"
            ? "⚠"
            : "●";

        return (

          <div
            key={index}
            className="flex gap-3 items-start"
          >

            <span
              className={`${colour} font-bold`}
            >
              {icon}
            </span>

            <span className="text-sm leading-6">
              {item.text}
            </span>

          </div>

        );

      })}

      <div className="mt-6 border-t border-zinc-800 pt-4">

        <p className="mb-2 text-sm font-semibold text-zinc-300">
          Summary
        </p>

        <p className="text-sm leading-6 text-zinc-400">
          {summary}
        </p>

      </div>

    </div>
    </DashboardCard>
  );
}