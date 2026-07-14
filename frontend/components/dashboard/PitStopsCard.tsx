"use client";
import DashboardCard from "./DashboardCard";
interface PitStop {
  driver: string;
  stop: number;
  lap: number;
  duration: number;
}

interface Props {
  pitStops: PitStop[];
}

export default function PitStopsCard({ pitStops }: Props) {
  const grouped = pitStops.reduce(
    (acc, stop) => {
      if (!acc[stop.driver]) {
        acc[stop.driver] = [];
      }

      acc[stop.driver].push(stop);
      return acc;
    },
    {} as Record<string, PitStop[]>
  );

  if (pitStops.length === 0) {
  return (
    <DashboardCard title="Pit Stops">
      <div className="py-6 text-center text-sm text-zinc-400">
        No pit stop data available.
      </div>
    </DashboardCard>
  );
}

  return (
    <DashboardCard title="Pit Stops">
    

      <div className="space-y-6">
        {Object.entries(grouped).map(([driver, stops]) => (
          <div key={driver}>
            <h3 className="mb-3 text-lg font-bold text-blue-400">
              {driver}
            </h3>

            <div className="space-y-2">
              {stops.map((stop) => (
                <div
                  key={`${driver}-${stop.stop}`}
                  className="flex justify-between rounded-md bg-zinc-800 px-3 py-2"
                >
                  <span>
                    Stop {stop.stop}
                  </span>

                  <span>
                    Lap {stop.lap}
                  </span>

                  <span>
                    {stop.duration.toFixed(2)} s
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}