"use client";

import DashboardCard from "./DashboardCard";

interface Message {
  time: string;
  category: string;
  message: string;
  status: string;
  flag: string;
  scope: string;
}

interface Props {
  messages: Message[];
}

export default function SessionTimeline({
  messages,
}: Props) {

  if (!messages.length) {
    return (
        <DashboardCard title="Session Timeline">
            <div className="py-6 text-center text-sm text-zinc-400">
                No session events available.
            </div>
        </DashboardCard>
    );
}

  return (
    <DashboardCard title="Session Timeline">

      <div className="space-y-4 max-h-96 overflow-y-auto">

        {messages.map((msg, index) => (

          <div
            key={index}
            className="flex gap-4"
          >

            <div className="flex flex-col items-center">

              <div className="h-3 w-3 rounded-full bg-red-500" />

              {index !== messages.length - 1 && (
                <div className="w-px flex-1 bg-zinc-700" />
              )}

            </div>

            <div className="pb-5">

              <p className="text-sm text-zinc-400">
                {msg.time}
                </p>

              <p className="font-semibold">
                {msg.category}
              </p>

              <p className="text-sm text-zinc-300">
                {msg.message}
              </p>

            </div>

          </div>

        ))}

      </div>

    </DashboardCard>
  );
}