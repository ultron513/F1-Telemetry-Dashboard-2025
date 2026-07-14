"use client";

import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardCard from "./DashboardCard";

interface Point {
  lap: number;
  lap_time: number;
}

interface Props {
  data: Point[];
}

export default function LapPaceDistribution({
  data,
}: Props) {

  if (!data.length) {
    return null;
  }

  return (
    <DashboardCard title="Lap Pace Distribution">

      <div className="h-72">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <BarChart data={data}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="lap" />

            <YAxis />

            <Tooltip />

            <Bar
              dataKey="lap_time"
              radius={[4, 4, 0, 0]}
              fill="#06b6d4"
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

    </DashboardCard>
  );
}