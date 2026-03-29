/**
 * OpenTelemetry Browser Client Utilities
 * 
 * This module provides client-side OpenTelemetry utilities that can be safely imported
 * from client components (unlike instrumentation.ts which is the Next.js module hook).
 * 
 * Exports:
 * - initializeOpenTelemetry(): Initialize the tracer
 * - getTracer(): Get the global tracer instance
 * - createSpan(): Create a manual span with attributes
 */

let globalTracer: any = null;
let globalProvider: any = null;

/**
 * Get the global tracer instance (lazy-initialized)
 */
export function getTracer() {
  return globalTracer;
}

/**
 * Set the global tracer (called from instrumentation.ts)
 */
export function setTracer(tracer: any) {
  globalTracer = tracer;
}

/**
 * Set the global provider (called from instrumentation.ts)
 */
export function setProvider(provider: any) {
  globalProvider = provider;
}

/**
 * Get the global provider instance
 */
export function getProvider() {
  return globalProvider;
}

/**
 * Initialize OpenTelemetry for browser-side tracing
 * This is a client-safe wrapper around the instrumentation logic
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

  console.log('[OTEL] Client-side OpenTelemetry initialization');
  (window as any).__OTEL_INITIALIZED__ = true;
}

/**
 * Get user context for tracing
 */
function getUserContext(): Record<string, string | number> {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    'user.browser': navigator.userAgent.substring(0, 100),
    'user.language': navigator.language,
    'user.timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
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
