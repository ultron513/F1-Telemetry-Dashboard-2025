"use client";

import { ReactNode } from "react";

interface DashboardGridProps {
  left: ReactNode;
  right: ReactNode;
}

export default function DashboardGrid({
  left,
  right,
}: DashboardGridProps) {
  return (
    <div className="grid gap-8 xl:grid-cols-3">
      <div className="space-y-8 xl:col-span-2">
        {left}
      </div>

      <aside className="space-y-8 xl:sticky xl:top-6 xl:self-start">
        {right}
      </aside>
    </div>
  );
}