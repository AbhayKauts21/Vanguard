/**
 * Telemetry Provider Component
 * 
 * This component initializes OpenTelemetry on mount and provides
 * a context for accessing telemetry features throughout the app.
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initializeOpenTelemetry, getTracer } from './instrumentation';

interface TelemetryContextValue {
  initialized: boolean;
  tracer: ReturnType<typeof getTracer>;
}

const TelemetryContext = createContext<TelemetryContextValue>({
  initialized: false,
  tracer: null,
});

export function useTelemetry() {
  return useContext(TelemetryContext);
}

interface TelemetryProviderProps {
  children: React.ReactNode;
}

export function TelemetryProvider({ children }: TelemetryProviderProps) {
  const [initialized, setInitialized] = useState(false);
  const [tracer, setTracer] = useState<ReturnType<typeof getTracer>>(null);

  useEffect(() => {
    // Initialize OpenTelemetry on client mount
    if (typeof window !== 'undefined' && !initialized) {
      try {
        initializeOpenTelemetry();
        setTracer(getTracer());
        setInitialized(true);
      } catch (error) {
        console.error('[OTEL] Failed to initialize:', error);
      }
    }
  }, [initialized]);

  return (
    <TelemetryContext.Provider value={{ initialized, tracer }}>
      {children}
    </TelemetryContext.Provider>
  );
}
