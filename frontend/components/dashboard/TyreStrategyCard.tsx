"use client";
import DashboardCard from "./DashboardCard";
interface Stint {
  driver: string;
  stint: number;
  compound: string;
  laps: number;
  fresh_tyre: boolean;
}

interface Props {
  stints: Stint[];
}

const tyreColours: Record<string, string> = {
  SOFT: "bg-red-500",
  MEDIUM: "bg-yellow-400",
  HARD: "bg-white",
  INTERMEDIATE: "bg-green-500",
  WET: "bg-blue-500",
};

export default function TyreStrategyCard({ stints }: Props) {
  if (!stints.length) {
    return (
      <DashboardCard title="Tyre Strategy">
        <div className="py-6 text-center text-sm text-zinc-400">
          No tyre strategy data available.
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Tyre Strategy">
      

      <div className="space-y-5">
        {stints.map((stint, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b border-zinc-800 pb-3"
          >
            <div>
              <div className="font-semibold">
                {stint.driver}
              </div>

              <div className="text-sm text-zinc-400">
                Stint {stint.stint}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full ${
                  tyreColours[stint.compound.toUpperCase()] ??
                  "bg-zinc-500"
                }`}
              />

              <span>{stint.compound}</span>

              <span className="text-zinc-400">
                {stint.laps} laps
              </span>

              {stint.fresh_tyre && (
                <span className="rounded bg-green-700 px-2 py-1 text-xs">
                  New
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}