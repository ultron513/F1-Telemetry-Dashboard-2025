"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Props {
  data: any[];
}

export default function LapDeltaChart({
  data,
}: Props) {
  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-4 text-lg font-semibold">
        Lap Delta
      </h2>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="distance"
            tickFormatter={(v) => `${Math.round(v)} m`}
          />

          <YAxis
            tickFormatter={(v) => `${v.toFixed(1)}s`}
          />

          <Tooltip
            labelFormatter={(v) =>
              `Distance ${Math.round(Number(v))} m`
            }
            formatter={(v: any) => [
              `${Number(v).toFixed(3)} s`,
              "Delta",
            ]}
          />

          <ReferenceLine
            y={0}
            stroke="#ffffff"
            strokeDasharray="5 5"
          />

          <Line
            type="monotone"
            dataKey="delta"
            stroke="#00bfff"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}