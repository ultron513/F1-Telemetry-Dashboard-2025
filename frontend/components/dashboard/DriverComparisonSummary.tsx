"use client";

interface Props {
  driver1: string;
  driver2: string;

  lapTime1: number;
  lapTime2: number;

  topSpeed1: number;
  topSpeed2: number;

  sector1_1: number | null;
  sector1_2: number | null;

  sector2_1: number | null;
  sector2_2: number | null;

  sector3_1: number | null;
  sector3_2: number | null;
}

export default function DriverComparisonSummary({
  driver1,
  driver2,
  lapTime1,
  lapTime2,
  topSpeed1,
  topSpeed2,
  sector1_1,
  sector1_2,
  sector2_1,
  sector2_2,
  sector3_1,
  sector3_2,
}: Props) {

  const Row = ({
    label,
    left,
    right,
    lowerIsBetter = true,
  }: {
    label: string;
    left: number | null;
    right: number | null;
    lowerIsBetter?: boolean;
  }) => {

    if (left == null || right == null) {
      return null;
    }

    const leftWins = lowerIsBetter
      ? left < right
      : left > right;

    return (
      <div className="grid grid-cols-3 items-center py-2 border-b border-zinc-800">

        <div
          className={`font-semibold ${
            leftWins
              ? "text-green-400"
              : "text-red-400"
          }`}
        >
          {left.toFixed(3)}
        </div>

        <div className="text-center text-zinc-400">
          {label}
        </div>

        <div
          className={`text-right font-semibold ${
            !leftWins
              ? "text-green-400"
              : "text-red-400"
          }`}
        >
          {right.toFixed(3)}
        </div>

      </div>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-5 text-xl font-bold">
        Driver Comparison
      </h2>

      <div className="grid grid-cols-3 mb-4">

        <div className="font-bold">
          {driver1}
        </div>

        <div />

        <div className="text-right font-bold">
          {driver2}
        </div>

      </div>

      <Row
        label="Lap Time"
        left={lapTime1}
        right={lapTime2}
      />

      <Row
        label="Top Speed"
        left={topSpeed1}
        right={topSpeed2}
        lowerIsBetter={false}
      />

      <Row
        label="Sector 1"
        left={sector1_1}
        right={sector1_2}
      />

      <Row
        label="Sector 2"
        left={sector2_1}
        right={sector2_2}
      />

      <Row
        label="Sector 3"
        left={sector3_1}
        right={sector3_2}
      />

    </div>
  );
}