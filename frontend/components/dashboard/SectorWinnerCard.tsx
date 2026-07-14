"use client";

interface Props {
  sector1: {
    driver: string;
    sector1: number | null;
    sector2: number | null;
    sector3: number | null;
  };

  sector2: {
    driver: string;
    sector1: number | null;
    sector2: number | null;
    sector3: number | null;
  };

  sector3: {
    driver: string;
    sector1: number | null;
    sector2: number | null;
    sector3: number | null;
  };
}

export default function SectorWinnerCard({
  sector1,
  sector2,
  sector3,
}: Props) {
  const winner1 =
  (sector1.sector1 ?? Infinity) <= (sector2.sector1 ?? Infinity)
    ? sector1.driver
    : sector2.driver;

  const winner2 =
  (sector1.sector2 ?? Infinity) <= (sector2.sector2 ?? Infinity)
      ? sector1.driver
      : sector2.driver;

  const winner3 =
  (sector1.sector3 ?? Infinity) <= (sector2.sector3 ?? Infinity)
      ? sector1.driver
      : sector2.driver;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow">

      <h2 className="mb-5 text-xl font-bold">
        Sector Winners
      </h2>

      <div className="space-y-4">

        <div className="flex items-center justify-between">
          <span>Sector 1</span>
          <span className="font-bold text-green-400">
            {winner1}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Sector 2</span>
          <span className="font-bold text-green-400">
            {winner2}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Sector 3</span>
          <span className="font-bold text-green-400">
            {winner3}
          </span>
        </div>

      </div>

    </div>
  );
}