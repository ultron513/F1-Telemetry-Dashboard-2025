"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Timer,
  Gauge,
  Map,
  Cloud,
  Trophy,
  Flag,
  Activity,
  Settings,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Telemetry", icon: Activity, href: "/telemetry" },
  { name: "Lap Analysis", icon: Timer, href: "/laps" },
  { name: "Track Map", icon: Map, href: "/track-map" },
  { name: "Performance", icon: Gauge, href: "/performance" },
  { name: "Weather", icon: Cloud, href: "/weather" },
  { name: "Standings", icon: Trophy, href: "/standings" },
  { name: "Race Control", icon: Flag, href: "/race-control" },
  { name: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen border-r bg-background">
      <div className="p-6 text-2xl font-bold">
        F1 Analytics
      </div>

      <nav className="px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}