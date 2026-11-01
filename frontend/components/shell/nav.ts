import {
  Activity,
  Microscope,
  UserRoundCheck,
  CloudSun,
  Flag,
  FlaskConical,
  Gauge,
  History,
  Layers,
  Radio,
  ServerCog,
  Route,
  Settings,
  Swords,
  Timer,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Session",
    items: [
      { href: "/", label: "Overview", icon: Gauge, description: "Result, highlights and the season so far" },
      { href: "/live", label: "Live", icon: Radio, description: "Live timing, pit windows and win chances" },
      { href: "/telemetry", label: "Telemetry", icon: Activity, description: "Speed, throttle, brake, gear and delta traces" },
      { href: "/laps", label: "Lap analysis", icon: Timer, description: "Timing screen, stints and pace distribution" },
      { href: "/track-map", label: "Track map", icon: Route, description: "Speed, gear and dominance around the lap" },
      { href: "/strategy", label: "Strategy", icon: Layers, description: "Tyres, pit stops, degradation and race trace" },
      { href: "/simulator", label: "Simulator", icon: FlaskConical, description: "Re-run the race with a different tyre plan" },
      { href: "/analysis", label: "Driver & car", icon: Microscope, description: "Driving style, ideal lap, car traits, tyre care" },
      { href: "/performance", label: "Head to head", icon: Swords, description: "Driver ratings and lap comparison" },
      { href: "/race-control", label: "Race control", icon: Flag, description: "Replay, flags, stewards and track status" },
      { href: "/weather", label: "Weather", icon: CloudSun, description: "Temperatures, wind and rain through the session" },
    ],
  },
  {
    section: "Season",
    items: [
      { href: "/standings", label: "Standings", icon: Trophy, description: "Championship tables and points progression" },
      { href: "/teammates", label: "Team-mates", icon: UserRoundCheck, description: "Season head-to-heads within each team" },
      { href: "/history", label: "History", icon: History, description: "Champions, careers and circuits since 1950" },
      { href: "/drivers", label: "Drivers", icon: Users, description: "The grid for this session" },
    ],
  },
  {
    section: "App",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, description: "Units, theming and alerts" },
      { href: "/status", label: "Status", icon: ServerCog, description: "Service health, latency and background jobs" },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((s) => s.items);
