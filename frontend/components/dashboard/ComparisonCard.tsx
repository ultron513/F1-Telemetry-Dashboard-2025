"use client";

interface Props {
  title: string;
  leftDriver: string;
  rightDriver: string;
  leftValue: number | null;
  rightValue: number | null;
  unit?: string;
  higherIsBetter?: boolean;
}

export default function ComparisonCard({
  title,
  leftDriver,
  rightDriver,
  leftValue,
  rightValue,
  unit = "",
  higherIsBetter = true,
}: Props) {
  const safeLeft = Number(leftValue ?? 0);
  const safeRight = Number(rightValue ?? 0);

  const maxValue = Math.max(
    safeLeft,
    safeRight,
    1
  );

  const leftWins = higherIsBetter
    ? safeLeft > safeRight
    : safeLeft < safeRight;

  const rightWins = higherIsBetter
    ? safeRight > safeLeft
    : safeRight < safeLeft;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow">

      <div className="mb-4 flex items-center justify-between">

        <h3 className="text-lg font-semibold">
          {title}
        </h3>

        <span className="text-xs text-gray-400">
          Comparison
        </span>

      </div>

      <div className="space-y-5">

        <div>

          <div className="mb-2 flex justify-between">

            <span className="font-medium text-red-400">
              {leftDriver}
            </span>

            <span
              className={
                leftWins
                  ? "font-bold text-green-400"
                  : "text-gray-300"
              }
            >
              {leftValue != null
                ? `${leftValue.toFixed(2)}${unit}`
                : "--"}
            </span>

          </div>

          <div className="h-2 rounded bg-zinc-700">

            <div
              className="h-2 rounded bg-red-500 transition-all"
              style={{
                width: `${(safeLeft / maxValue) * 100}%`,
              }}
            />

          </div>

        </div>

        <div>

          <div className="mb-2 flex justify-between">

            <span className="font-medium text-cyan-400">
              {rightDriver}
            </span>

            <span
              className={
                rightWins
                  ? "font-bold text-green-400"
                  : "text-gray-300"
              }
            >
              {rightValue != null
                ? `${rightValue.toFixed(2)}${unit}`
                : "--"}
            </span>

          </div>

          <div className="h-2 rounded bg-zinc-700">

            <div
              className="h-2 rounded bg-cyan-500 transition-all"
              style={{
                width: `${(safeRight / maxValue) * 100}%`,
              }}
            />

          </div>

        </div>

      </div>

    </div>
  );
}