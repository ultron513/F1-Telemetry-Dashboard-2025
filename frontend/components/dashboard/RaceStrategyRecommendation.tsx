"use client";
import { getRaceStrategyRecommendation } from "@/lib/raceStrategy";

interface Props {
  degradation: number;
  consistency: number;
  lapsCompleted: number;
}

export default function RaceStrategyRecommendation({
  degradation,
  consistency,
  lapsCompleted,
}: Props) {
  const strategy = getRaceStrategyRecommendation(
  degradation,
  consistency,
  lapsCompleted
);
console.log(strategy);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow">
      <h2 className="mb-5 text-xl font-bold">
        Race Strategy Recommendation
      </h2>

      <div className="grid gap-4">

                <div className="flex justify-between">

        <span className="text-zinc-400">
            Strategy Status
        </span>

        <span
            className={`font-semibold ${
            strategy.status === "Stable"
                ? "text-green-400"
                : strategy.status === "Monitor"
                ? "text-yellow-400"
                : "text-red-400"
            }`}
        >
            {strategy.status}
        </span>

        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Recommended Action</span>
          <span className="font-semibold">{strategy.action}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Suggested Pit Window</span>
          <span>Lap {strategy.pitWindow}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Tyre Degradation</span>
          <span>{degradation.toFixed(3)} s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Pace Consistency</span>
          <span>{consistency.toFixed(3)} s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Risk Level</span>
          <span
             className={`font-semibold ${
                    strategy.risk === "LOW"
                    ? "text-green-400"
                    : strategy.risk === "MEDIUM"
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
                >
            {strategy.risk}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-400">Confidence</span>
          <span>{strategy.confidence}%</span>
        </div>

        <div className="h-2 w-full rounded-full bg-zinc-800">
            <div
                className={`h-2 rounded-full transition-all ${
                strategy.confidence >= 90
                    ? "bg-green-500"
                    : strategy.confidence >= 75
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{
                width: `${strategy.confidence}%`,
                }}
            />
            </div>

        <div className="border-t border-zinc-800 pt-4">
        <p className="mb-2 text-sm font-semibold text-zinc-300">
            Engineer Note
        </p>

        <p className="text-sm leading-6 text-zinc-400">
            {strategy.engineerMessage}
        </p>
        </div>

      </div>
    </div>
  );
}