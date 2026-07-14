"use client";
import DashboardCard from "./DashboardCard";
interface DriverScore {
  driver: string;
  score: number;
}

interface Props {
  scores: DriverScore[];
}

export default function DriverPerformanceScoreCard({
  scores,
}: Props) {
  if (!scores || scores.length < 2) return null;

  const left = scores[0];
  const right = scores[1];

  const winner =
    left.score >= right.score ? left : right;

  const difference = Math.abs(
    left.score - right.score
  ).toFixed(1);

  return (
    <DashboardCard title="Driver Performance">

      <div className="mb-6 flex items-center justify-between">

        <div>

          <p className="text-sm text-zinc-400">
            Driver Performance Score
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            {winner.driver}
          </h2>

          <p className="mt-1 text-sm text-green-400">
            Leads by {difference} points
          </p>

        </div>

        <div className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold">
          Performance Leader
        </div>

      </div>

      {[left, right].map((driver, index) => (

        <div
          key={driver.driver}
          className="mb-6 last:mb-0"
        >

          <div className="mb-2 flex justify-between">

            <span
              className={
                index === 0
                  ? "font-semibold text-red-400"
                  : "font-semibold text-cyan-400"
              }
            >
              {driver.driver}
            </span>

            <span className="font-bold">
              {driver.score.toFixed(1)}
            </span>

          </div>

          <div className="h-3 overflow-hidden rounded-full bg-zinc-700">

            <div
              className={
                index === 0
                  ? "h-full rounded-full bg-red-500 transition-all duration-700"
                  : "h-full rounded-full bg-cyan-500 transition-all duration-700"
              }
              style={{
                width: `${driver.score}%`,
              }}
            />

          </div>

        </div>

      ))}

    </DashboardCard>
  );
}