"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Props {
  data: any[];
  compareData?: any[];
  xKey: string;
  yKey: string;
  title: string;
  color?: string;
  unit?: string;
}

export default function TelemetryChart({
  data,
  compareData = [],
  xKey,
  yKey,
  title,
  color = "#ef4444",
  unit = "",
}: Props) {
  if (!data.length) {
    return (
      <div className="rounded-xl border p-4">
        <h2 className="mb-4 text-lg font-semibold">
          {title}
        </h2>

        <div className="flex h-[350px] items-center justify-center text-zinc-400">
          No telemetry data available.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-4 text-lg font-semibold">
        {title}
      </h2>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            type="number"
            dataKey={xKey}
            tickFormatter={(value) => `${Math.round(Number(value))} m`}
            tick={{ fontSize: 11 }}
            minTickGap={60}
            interval="preserveStartEnd"
          />

          <YAxis tick={{ fontSize: 12 }} />

          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#fff",
            }}
            labelFormatter={(value) =>
              `Distance: ${Math.round(Number(value))} m`
            }
            formatter={(value) => [
              `${Number(value ?? 0).toLocaleString()} ${unit}`,
              title,
            ]}
          />

          <Line
            data={data}
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />

          {compareData.length > 0 && (
            <Line
              data={compareData}
              type="monotone"
              dataKey={yKey}
              stroke="#00e5ff"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}