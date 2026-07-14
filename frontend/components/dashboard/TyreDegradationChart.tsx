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

export default function TyreDegradationChart({
  data,
}: Props) {
  return (
    <DashboardCard title="Tyre Degradation">
      <div className="h-72">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="lap" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="lap_time"
              stroke="#f97316"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}