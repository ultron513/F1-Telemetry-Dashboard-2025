"use client";

import { Menu, Moon, Settings, Sun, X } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";

import { DriverPicker, EventPicker, SeasonPicker, SessionPicker } from "@/components/shell/pickers";
import { useHealth } from "@/lib/api/queries";
import { API_BASE_URL } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { SelectionProvider, useSelection } from "@/state/selection";
import { TeamThemeProvider } from "@/state/team-theme";

import { NotificationCenter, Toaster } from "./notifications";
import { InstallButton, PwaRuntime } from "./pwa";
import { Brand, NavList, Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <TeamThemeProvider>
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <SessionBar />
            <main id="main" className="min-w-0 flex-1 px-4 pt-5 pb-16 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
        <PwaRuntime />
      </TeamThemeProvider>
    </SelectionProvider>
  );
}

export function ShellFallback() {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-[232px] shrink-0 border-r border-line bg-surface lg:block" />
      <div className="flex-1">
        <div className="h-1 bg-surface-3" />
        <div className="h-[60px] border-b border-line bg-surface" />
      </div>
    </div>
  );
}

function SessionBar() {
  const { driver, vs, set } = useSelection();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="livery h-1" aria-hidden />
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 lg:px-6">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" aria-label="Open navigation" className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 lg:hidden">
              <Menu className="size-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-surface data-[state=open]:animate-in data-[state=open]:slide-in-from-left">
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <div className="livery h-1" aria-hidden />
              <div className="flex h-[60px] items-center justify-between px-4">
                <Brand />
                <Dialog.Close aria-label="Close navigation" className="rounded-md p-1.5 text-ink-3 hover:text-ink">
                  <X className="size-5" />
                </Dialog.Close>
              </div>
              <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-6">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="scroll-thin flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
          <SeasonPicker className="w-[92px] shrink-0" />
          <EventPicker className="w-[220px] shrink-0" />
          <SessionPicker className="w-[150px] shrink-0" />
          <span className="mx-1 hidden h-8 w-px shrink-0 bg-line md:block" aria-hidden />
          <DriverPicker
            caption="Focus driver"
            value={driver}
            onChange={(c) => c && set({ driver: c })}
            className="w-[190px] shrink-0"
          />
          <DriverPicker
            caption="Compare with"
            value={vs}
            exclude={driver}
            allowNone
            onChange={(c) => set({ vs: c })}
            className="w-[190px] shrink-0"
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <InstallButton />
          <ApiStatus />
          <NotificationCenter />
          <ThemeToggle />
          <Link href="/settings" aria-label="Settings" className="hidden size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink sm:inline-flex">
            <Settings className="size-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function ApiStatus() {
  const health = useHealth();
  const ok = health.data?.status === "ok";
  const label = health.isLoading ? "Connecting to API" : ok ? `API online (${API_BASE_URL})` : "Data server unreachable or waking up";
  return (
    <span title={label} className="hidden items-center gap-1.5 px-2 text-xs text-ink-3 xl:inline-flex">
      <span className={cn("size-2 rounded-full", health.isLoading ? "bg-ink-3" : ok ? "bg-good" : "animate-pulse-dot bg-bad")} aria-hidden />
      {health.isLoading ? "Connecting" : ok ? "Live data" : "Offline"}
    </span>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = !mounted || resolvedTheme !== "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink"
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}
