"""
OpenTelemetry Middleware for FastAPI

This middleware adds OpenTelemetry tracing context to all requests,
including custom attributes like user_id, request_id, and endpoint.
"""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.core.telemetry import add_span_attributes


class TelemetryMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enhance OpenTelemetry tracing with custom attributes
    and structured logging.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and add telemetry attributes.
        
        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain
            
        Returns:
            HTTP response
        """
        # Get current span
        span = trace.get_current_span()
        
        # Record start time
        start_time = time.time()
        
        # Extract request metadata
        request_id = getattr(request.state, "request_id", None)
        user_id = self._extract_user_id(request)
        
        # Resolve the matched route template (e.g. /api/v1/chat/{session_id})
        # This is what populates http.target correctly in Prometheus metrics.
        route = request.scope.get("route")
        http_target = route.path if (route and hasattr(route, "path")) else request.url.path

        # Add custom attributes to span
        if span and span.is_recording():
            attributes = {
                "request.id": request_id,
                "user.id": user_id,
                "http.target": http_target,
                "http.route": http_target,
                "http.method": request.method,
                "http.scheme": request.url.scheme,
                "http.host": request.url.hostname,
                "http.client.ip": self._get_client_ip(request),
                "http.user_agent": request.headers.get("user-agent"),
            }
            
            # Add query parameters (be careful with sensitive data)
            if request.query_params:
                for key, value in request.query_params.items():
                    if key.lower() not in ['password', 'token', 'secret', 'key']:
                        attributes[f"http.query.{key}"] = value
            
            add_span_attributes(span, attributes)
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Add response attributes
            if span and span.is_recording():
                span.set_attribute("http.status_code", response.status_code)
                span.set_attribute("http.response.duration_ms", duration * 1000)
                
                # Set span status based on response
                if response.status_code >= 500:
                    span.set_status(
                        Status(StatusCode.ERROR, f"HTTP {response.status_code}")
                    )
                elif response.status_code >= 400:
                    span.set_status(
                        Status(StatusCode.ERROR, f"HTTP {response.status_code}")
                    )
                else:
                    span.set_status(Status(StatusCode.OK))
            
            # Add trace context to response headers for debugging
            if request_id:
                response.headers["X-Request-ID"] = request_id
            
            trace_id = span.get_span_context().trace_id if span else None
            if trace_id:
                response.headers["X-Trace-ID"] = format(trace_id, "032x")
            
            return response
            
        except Exception as exc:
            # Record exception in span
            if span and span.is_recording():
                span.record_exception(exc)
                span.set_status(
                    Status(StatusCode.ERROR, str(exc))
                )
            raise
    
    def _extract_user_id(self, request: Request) -> str:
        """
        Extract user ID from request state or JWT token.
        
        Args:
            request: HTTP request
            
        Returns:
            User ID if available, None otherwise
        """
        # Check if user is attached to request state (from auth middleware)
        if hasattr(request.state, "user"):
            user = request.state.user
            if hasattr(user, "id"):
                return str(user.id)
            if isinstance(user, dict):
                return str(user.get("id") or user.get("user_id"))
        
        return None
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Get client IP address, considering proxies.
        
        Args:
            request: HTTP request
            
        Returns:
            Client IP address
        """
        # Check for forwarded IP (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to client host
        if request.client:
            return request.client.host
        
        return "unknown"
