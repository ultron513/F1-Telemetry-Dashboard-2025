"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function PaceEvolutionChart({
  data,
}: Props) {
  return (
    <DashboardCard title="Pace Evolution">
      <div className="h-72">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="lap" />

            <YAxis
              domain={["dataMin - 0.2", "dataMax + 0.2"]}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="lap_time"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}