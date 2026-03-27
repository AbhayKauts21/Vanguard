/**
 * OpenTelemetry Next.js Module Hook
 * 
 * This file is automatically loaded by Next.js during build and startup.
 * It should NOT be directly imported from other files.
 * Use ./lib/otel-client.ts for client-side telemetry utilities.
 * 
 * References:
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { B3Propagator, B3InjectEncoding } from '@opentelemetry/propagator-b3';
import { CompositePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { setTracer, setProvider } from './lib/otel-client';

// Environment-specific configuration
const OTEL_EXPORTER_OTLP_ENDPOINT = 
  process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || 
  'http://localhost:4318/v1/traces';

const ENVIRONMENT = process.env.NODE_ENV || 'development';
const SERVICE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

/**
 * Setup OpenTelemetry for the Next.js application
 * This is called automatically by Next.js module hook system
 */
function setupOpenTelemetry(): void {
  if (typeof window === 'undefined') {
    console.log('[OTEL] Skipping setup - not in browser environment');
    return;
  }

  try {
    // Create tracer provider with resource
    const provider = new WebTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'cleo-frontend',
        [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
        environment: ENVIRONMENT,
      }),
    });

    // Add OTLP trace exporter
    const exporter = new OTLPTraceExporter({
      url: OTEL_EXPORTER_OTLP_ENDPOINT,
    });

    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Setup propagators (B3 for distributed tracing, W3C as fallback)
    const propagator = new CompositePropagator({
      propagators: [
        new B3Propagator({
          injectEncoding: B3InjectEncoding.MULTI_HEADER,
        }),
        new W3CTraceContextPropagator(),
      ],
    });

    // Register instrumentations
    registerInstrumentations({
      tracerProvider: provider,
      instrumentations: [
        new FetchInstrumentation(),
        new XMLHttpRequestInstrumentation(),
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit', 'change', 'keydown'],
        }),
        new DocumentLoadInstrumentation(),
      ],
    });

    // Set context manager for async operations
    provider.register({
      contextManager: new ZoneContextManager(),
    });

    // Export for client-side usage
    setProvider(provider);
    setTracer(provider.getTracer('cleo-web'));

    console.log('[OTEL] Setup complete');
  } catch (error) {
    console.error('[OTEL] Setup failed:', error);
  }
}

/**
 * Required export for Next.js Module Hook system
 * This function is called during Next.js build and startup
 */
export async function register() {
  // Setup instrumentation when the module is loaded
  setupOpenTelemetry();
}
