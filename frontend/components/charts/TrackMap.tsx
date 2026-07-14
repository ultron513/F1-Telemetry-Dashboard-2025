"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface Point {
  x: number;
  y: number;
}

interface Props {
  data: Point[];
}

export default function TrackMap({ data }: Props) {
  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-4 text-lg font-semibold">
        Track Map
      </h2>

      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }} style={{ backgroundColor: "#0f172a" }}>
          <XAxis
            type="number"
            dataKey="x"
            hide
            domain={["dataMin", "dataMax"]}
            scale="linear"
          />

          <YAxis
            type="number"
            dataKey="y"
            hide
            domain={["dataMin", "dataMax"]}
            scale="linear"
          />

          <Tooltip
            cursor={false}
            contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #333",
                borderRadius: "8px",
            }}
            
          />

          <Scatter
            data={data}
            shape={(props: any) => {
                const speed = props.payload.speed;

                let color = "#22c55e";

                if (speed > 250) color = "#ef4444";
                else if (speed > 180) color = "#f59e0b";
                else if (speed > 100) color = "#3b82f6";

                return (
                <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={1.8}
                    fill={color}
                />
                );
            }}
            />

            <Scatter
            data={data.length ? [data[0]] : []}
            fill="#22c55e"
            />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}