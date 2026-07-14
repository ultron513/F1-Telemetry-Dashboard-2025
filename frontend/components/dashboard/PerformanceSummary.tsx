interface Props {
  driver1: string;
  driver2: string;
  lap1: number;
  lap2: number;
  lapTime1: number;
  lapTime2: number;
}

export default function PerformanceSummary({
  driver1,
  driver2,
  lap1,
  lap2,
  lapTime1,
  lapTime2,
}: Props) {
  const winner =
    lapTime1 < lapTime2 ? driver1 : driver2;

  const gap = Math.abs(lapTime1 - lapTime2);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 mb-6">

      <div className="flex justify-between items-center">

        <div>
          <p className="text-sm text-zinc-400">
            Faster Driver
          </p>

          <h2 className="text-2xl font-bold text-green-400">
            {winner}
          </h2>
        </div>

        <div className="text-right">
          <p className="text-sm text-zinc-400">
            Gap
          </p>

          <h2 className="text-2xl font-bold">
            {gap.toFixed(3)} s
          </h2>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">

        <div className="rounded-lg bg-zinc-950 p-4">

          <p className="text-zinc-400">
            {driver1}
          </p>

          <p className="text-xl font-semibold">
            {lapTime1 != null ? lapTime1.toFixed(3) : "--"} s
          </p>

          <p className="text-sm text-zinc-500">
            Lap {lap1}
          </p>

        </div>

        <div className="rounded-lg bg-zinc-950 p-4">

          <p className="text-zinc-400">
            {driver2}
          </p>

          <p className="text-xl font-semibold">
            {lapTime2 != null ? lapTime2.toFixed(3) : "--"} s
          </p>

          <p className="text-sm text-zinc-500">
            Lap {lap2}
          </p>

        </div>

      </div>

    </div>
  );
}