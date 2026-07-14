"use client";

interface Props {
  degradation: number;
  consistency: number;
}

export default function RaceHealthCard({
  degradation,
  consistency,
}: Props) {

  let health = "Excellent";
  let color = "text-green-400";

  if (degradation > 1.5 || consistency > 0.8) {
    health = "Critical";
    color = "text-red-400";
  } else if (degradation > 0.8 || consistency > 0.5) {
    health = "Monitor";
    color = "text-yellow-400";
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-4 text-xl font-bold">
        Race Health
      </h2>

      <p className={`text-2xl font-bold ${color}`}>
        {health}
      </p>

      <p className="mt-2 text-sm text-zinc-400">
        Combined assessment of tyre degradation and pace consistency.
      </p>
    </div>
  );
}