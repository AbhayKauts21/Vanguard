/**
 * OpenTelemetry Browser Instrumentation
 * 
 * This module initializes OpenTelemetry for the Next.js frontend, enabling:
 * - Distributed tracing across frontend and backend
 * - Automatic instrumentation of fetch/XHR requests
 * - User interaction tracking
 * - Page load and navigation metrics
 * - B3 propagation for trace context
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

// Environment-specific configuration
const OTEL_EXPORTER_OTLP_ENDPOINT = 
  process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || 
  'http://localhost:4318/v1/traces';

const ENVIRONMENT = process.env.NODE_ENV || 'development';
const SERVICE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

/**
 * Initialize OpenTelemetry for browser-side tracing
 */
export function initializeOpenTelemetry(): void {
  // Only initialize in browser environment
  if (typeof window === 'undefined') {
    console.log('[OTEL] Skipping browser instrumentation on server');
    return;
  }

  // Check if already initialized
  if ((window as any).__OTEL_INITIALIZED__) {
    console.log('[OTEL] Already initialized, skipping');
    return;
  }

  console.log('[OTEL] Initializing OpenTelemetry Web SDK');
  console.log(`[OTEL] Export endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

  // Define service resource attributes
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'cleo-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    'service.namespace': 'cleo',
  });

  // Create tracer provider with resource
  const provider = new WebTracerProvider({
    resource,
  });

  // Configure OTLP exporter
  const otlpExporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: {
      // Add custom headers if needed (e.g., API keys)
    },
  });

  // Add batch span processor for efficient export
  provider.addSpanProcessor(
    new BatchSpanProcessor(otlpExporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 10,
      scheduledDelayMillis: 1000,
    })
  );

  // Configure propagators for trace context
  // Use both B3 (for backend compatibility) and W3C Trace Context
  provider.register({
    contextManager: new ZoneContextManager(),
    propagator: new CompositePropagator({
      propagators: [
        new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
        new W3CTraceContextPropagator(),
      ],
    }),
  });

  // Register auto-instrumentations
  registerInstrumentations({
    instrumentations: [
      // Instrument fetch API
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /.*/,  // Propagate trace headers to all origins
        ],
        clearTimingResources: true,
        applyCustomAttributesOnSpan: (span, request, response) => {
          // Add custom attributes to fetch spans
          if (response && typeof response.status === 'number') {
            span.setAttribute('http.response.status_code', response.status);
          }
          
          // Extract user context if available
          try {
            const userInfo = getUserContext();
            if (userInfo.userId) {
              span.setAttribute('user.id', userInfo.userId);
            }
            if (userInfo.locale) {
              span.setAttribute('user.locale', userInfo.locale);
            }
          } catch (error) {
            // Silently ignore if user context is not available
          }
        },
      }),

      // Instrument XMLHttpRequest (for libraries that use it)
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /.*/,
        ],
      }),

      // Instrument user interactions (clicks, etc.)
      new UserInteractionInstrumentation({
        eventNames: ['click', 'submit'],
        shouldPreventSpanCreation: (eventType, element) => {
          // Avoid creating spans for non-interactive elements
          return element.tagName === 'DIV' || element.tagName === 'SPAN';
        },
      }),

      // Instrument document load events
      new DocumentLoadInstrumentation(),
    ],
  });

  // Mark as initialized
  (window as any).__OTEL_INITIALIZED__ = true;

  console.log('[OTEL] Initialization complete');
}

/**
 * Get user context for trace attributes
 * This should integrate with your auth/session management
 */
function getUserContext(): { userId?: string; locale?: string; route?: string } {
  try {
    // Extract locale from URL or document
    const locale = document.documentElement.lang || 
                   window.location.pathname.split('/')[1];

    // Extract route
    const route = window.location.pathname;

    // Extract user ID from session storage or auth store
    // Adjust this based on your auth implementation
    let userId: string | undefined;
    
    try {
      const authData = sessionStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        userId = parsed.user?.id || parsed.userId;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }

    return {
      userId,
      locale,
      route,
    };
  } catch (error) {
    console.warn('[OTEL] Error extracting user context:', error);
    return {};
  }
}

/**
 * Get the active tracer for manual instrumentation
 */
export function getTracer() {
  if (typeof window === 'undefined') {
    return null;
  }

  const { trace } = require('@opentelemetry/api');
  return trace.getTracer('cleo-frontend', SERVICE_VERSION);
}

/**
 * Create a custom span for manual instrumentation
 * 
 * @example
 * const span = createSpan('user.login', { 'user.email': email });
 * try {
 *   await performLogin();
 *   span.setStatus({ code: SpanStatusCode.OK });
 * } catch (error) {
 *   span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
 *   span.recordException(error);
 * } finally {
 *   span.end();
 * }
 */
export function createSpan(name: string, attributes?: Record<string, string | number | boolean>) {
  const tracer = getTracer();
  if (!tracer) {
    return null;
  }

  const span = tracer.startSpan(name, {
    attributes: {
      ...attributes,
      ...getUserContext(),
    },
  });

  return span;
}
