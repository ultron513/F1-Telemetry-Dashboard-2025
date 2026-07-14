"use client";

import { AlertTriangle } from "lucide-react";
import { RaceControlMessage } from "@/services/raceControlService";
import DashboardCard from "./DashboardCard";

interface Props {
  messages: RaceControlMessage[];
}

export default function RaceControlPanel({
  messages,
}: Props) {
  return (
    <DashboardCard title="Race Control">

      

      <div className="max-h-80 space-y-3 overflow-y-auto">

        {messages.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-400">
            No race control messages for this session.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="flex justify-between">

                <span className="font-semibold">
                  {message.flag || message.category}
                </span>

                <span className="text-sm text-zinc-400">
                  {message.time}
                </span>

              </div>

              <p className="mt-2 text-sm">
                {message.message}
              </p>

            </div>
          ))
        )}

      </div>

    </DashboardCard>
  );
}