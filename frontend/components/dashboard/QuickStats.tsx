"use client";
import { ReactNode } from "react";
import {
  Gauge,
  Timer,
  Flag,
  User,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Stat {
  label: string;
  value: string | number;
}

interface Props {
  stats: Stat[];
}

const iconMap: Record<string, React.ReactNode> = {
  "Selected Driver": (
    <User
      size={18}
      className="text-cyan-400"
    />
  ),

  "Lap Time": (
    <Timer
      size={18}
      className="text-purple-400"
    />
  ),

  "Top Speed": (
    <Gauge
      size={18}
      className="text-red-400"
    />
  ),

  "Lap Number": (
    <Flag
      size={18}
      className="text-yellow-400"
    />
  ),
};

export default function QuickStats({
  stats,
}: Props) {
  return (
    <Card className="transition-all duration-300 hover:shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl">
          Quick Stats
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4">
          {stats.length === 0 ? (

              <div className="py-6 text-center text-sm text-zinc-400">
                No statistics available for the selected driver.
              </div>

            ) : (

              stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <span className="text-muted-foreground">
                    {stat.label}
                  </span>

                  <span className="font-semibold">
                    {stat.value}
                  </span>
                </div>
              ))

            )}
        </div>
      </CardContent>
    </Card>
  );
}