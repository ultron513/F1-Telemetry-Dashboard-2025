"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSelection } from "@/state/selection";
import { useTeamTheme } from "@/state/team-theme";
import { cn } from "@/lib/utils";

import { NAV } from "./nav";

export function Brand({ compact }: { compact?: boolean }) {
  const theme = useTeamTheme();
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Pit Wall home">
      <span className="relative flex h-7 w-9 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 -skew-x-[18deg] rounded-[3px] bg-team transition-colors" />
        <span className="absolute top-0 right-0 bottom-0 w-1.5 -skew-x-[18deg] bg-team-2" />
        <span className="relative text-[13px] font-bold italic text-on-team">PW</span>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-bold italic tracking-tight text-ink">Pit Wall</span>
          <span className="mt-0.5 block text-[11px] text-ink-3">{theme.key === "neutral" ? "Telemetry dashboard" : theme.name}</span>
        </span>
      )}
    </Link>
  );
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { queryString } = useSelection();
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV.map((group) => (
        <div key={group.section}>
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-ink-3">{group.section}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={queryString ? `${item.href}?${queryString}` : item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors",
                      active ? "bg-surface-3 font-semibold text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-team" aria-hidden />}
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-team" : "text-ink-3")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-[60px] items-center px-4">
        <Brand />
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-2 py-3">
        <NavList />
      </div>
      <div className="border-t border-line px-4 py-3 text-[11.5px] leading-snug text-ink-3">
        Timing data via FastF1. Not affiliated with Formula 1 or the FIA.
      </div>
    </aside>
  );
}
