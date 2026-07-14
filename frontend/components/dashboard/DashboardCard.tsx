"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

export default function DashboardCard({
  title,
  children,
}: Props) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-zinc-800
        bg-zinc-900/95
        p-6
        shadow-lg
        transition-all
        duration-300
        hover:border-zinc-700
        hover:shadow-xl
      "
    >
      <h2 className="mb-5 text-xl font-bold tracking-tight">
        {title}
      </h2>

      {children}
    </div>
  );
}