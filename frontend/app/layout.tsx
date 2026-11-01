import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/400-italic.css";
import "@fontsource/titillium-web/600.css";
import "@fontsource/titillium-web/700.css";
import "@fontsource/titillium-web/700-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { AppShell, ShellFallback } from "@/components/shell/app-shell";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Pit Wall · F1 Telemetry Dashboard",
    template: "%s · Pit Wall",
  },
  description:
    "Interactive Formula 1 telemetry, strategy and race-control analysis for every session from 2023 to 2026, built on FastF1.",
  applicationName: "Pit Wall",
};

export const viewport: Viewport = {
  themeColor: "#0b0d11",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>
          <Suspense fallback={<ShellFallback />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
