/**
 * API Client with OpenTelemetry Integration
 * 
 * Enhanced fetch wrapper that automatically includes trace context
 * and custom attributes for backend correlation.
 */

import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Enhanced fetch wrapper with automatic tracing
 */
export async function tracedFetch(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;

  // Get active tracer
  const tracer = trace.getTracer('cleo-frontend');
  
  // Create span for this API call
  return tracer.startActiveSpan(
    `HTTP ${options.method || 'GET'} ${endpoint}`,
    {
      attributes: {
        'http.method': options.method || 'GET',
        'http.url': url,
        'http.target': endpoint,
      },
    },
    async (span) => {
      try {
        // Add timeout support
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
        });

        clearTimeout(timeoutId);

        // Record response attributes
        span.setAttribute('http.status_code', response.status);
        span.setAttribute('http.response.content_length', 
          response.headers.get('content-length') || 0
        );

        // Mark span as error if response is not ok
        if (!response.ok) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${response.status}: ${response.statusText}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        return response;
      } catch (error) {
        // Record exception
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * API Client methods
 */
export const apiClient = {
  async get<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    const response = await tracedFetch(endpoint, {
      ...options,
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async post<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> {
    const response = await tracedFetch(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async put<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> {
    const response = await tracedFetch(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async delete<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    const response = await tracedFetch(endpoint, {
      ...options,
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },
};
