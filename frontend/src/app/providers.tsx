"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { useState, type ReactNode } from "react";
import { TelemetryProvider } from "@/lib/telemetry-provider";
import type { AbstractIntlMessages } from "use-intl";

/* Root providers for client-side state management and observability. */
export function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
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
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TelemetryProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </TelemetryProvider>
    </NextIntlClientProvider>
  );
}
