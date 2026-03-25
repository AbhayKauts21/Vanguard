"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { TelemetryProvider } from "@/lib/telemetry-provider";

/* Root providers for client-side state management and observability. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <TelemetryProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TelemetryProvider>
  );
}
