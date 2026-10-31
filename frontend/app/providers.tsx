"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { ApiError, isTransient } from "@/lib/api/client";
import { PreferencesProvider } from "@/state/preferences";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (count, error) => {
              // A sleeping or busy server is worth waiting for (~2 minutes total)…
              if (isTransient(error)) return count < 6;
              // …errors that won't change on retry are not.
              if (error instanceof ApiError && [400, 404, 422, 503].includes(error.status)) return false;
              return count < 2;
            },
            retryDelay: (count, error) => (isTransient(error) ? Math.min(30_000, 5_000 * 2 ** count) : 1_000 * 2 ** count),
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <PreferencesProvider>{children}</PreferencesProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
