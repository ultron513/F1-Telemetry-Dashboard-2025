"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { PreferencesProvider } from "@/state/preferences";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (count, error) => {
              // Don't hammer the API for errors that won't change on retry.
              if (error instanceof ApiError && [404, 422, 503].includes(error.status)) return false;
              return count < 2;
            },
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
