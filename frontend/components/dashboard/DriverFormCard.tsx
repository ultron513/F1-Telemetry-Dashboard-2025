"use client";

interface Props {
  trend: number;
}

export default function DriverFormCard({ trend }: Props) {
  const improving = trend < -0.2;
  const declining = trend > 0.2;

  const label = improving
    ? "Improving"
    : declining
    ? "Dropping"
    : "Stable";

  const color = improving
    ? "text-green-400"
    : declining
    ? "text-red-400"
    : "text-yellow-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-5 text-xl font-bold">
        Driver Form
      </h2>

      <div className="flex items-center justify-between">
        <span className="text-zinc-400">
          Current Trend
        </span>

        <span className={`text-lg font-semibold ${color}`}>
          {label}
        </span>
      </div>
    </div>
  );
}