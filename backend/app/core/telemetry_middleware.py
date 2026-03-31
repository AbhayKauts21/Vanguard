"""
OpenTelemetry Middleware for FastAPI

Records HTTP server metrics (duration, active requests, request/response size)
with a correct http_target label (route template, e.g. /api/v1/chat/{session_id}).

The route is resolved AFTER call_next so FastAPI routing has already matched.
These metrics intentionally mirror the names used in the Grafana dashboards:
  - cleo_http_server_duration_milliseconds
  - cleo_http_server_active_requests
  - cleo_http_server_request_size_bytes
  - cleo_http_server_response_size_bytes
"""

import time
from typing import Callable

from fastapi import Request, Response
from opentelemetry import metrics, trace
from opentelemetry.trace import Status, StatusCode
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.telemetry import add_span_attributes

# ---------------------------------------------------------------------------
# OTel meters — created once at import time
# ---------------------------------------------------------------------------
_meter = metrics.get_meter("cleo-backend")

_duration_histogram = _meter.create_histogram(
    name="cleo_http_server_duration_milliseconds",
    description="HTTP server request duration in milliseconds",
    unit="ms",
)

_active_requests_gauge = _meter.create_up_down_counter(
    name="cleo_http_server_active_requests",
    description="Number of active HTTP server requests",
)

_request_size_histogram = _meter.create_histogram(
    name="cleo_http_server_request_size_bytes",
    description="HTTP server request body size in bytes",
    unit="By",
)

_response_size_histogram = _meter.create_histogram(
    name="cleo_http_server_response_size_bytes",
    description="HTTP server response body size in bytes",
    unit="By",
)


class TelemetryMiddleware(BaseHTTPMiddleware):
    """
    Middleware that:
    1. Records custom HTTP metrics with a correct http_target label.
    2. Enriches the OTel span with request/user attributes.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        span = trace.get_current_span()
        start_time = time.time()
        request_id = getattr(request.state, "request_id", None)
        user_id = self._extract_user_id(request)

        # Track active requests (label with method only — route not known yet)
        _active_requests_gauge.add(1, {"http_method": request.method})

        # Measure request body size from Content-Length header
        request_content_length = int(request.headers.get("content-length", 0) or 0)

        try:
            response = await call_next(request)
        except Exception as exc:
            if span and span.is_recording():
                span.record_exception(exc)
                span.set_status(Status(StatusCode.ERROR, str(exc)))
            _active_requests_gauge.add(-1, {"http_method": request.method})
            raise

        # ----------------------------------------------------------------
        # Route is resolved NOW (after call_next) — scope["route"] is set
        # ----------------------------------------------------------------
        route = request.scope.get("route")
        http_target = (
            route.path
            if (route and hasattr(route, "path"))
            else request.url.path
        )

        duration_ms = (time.time() - start_time) * 1000
        status_code = response.status_code
        response_content_length = int(response.headers.get("content-length", 0) or 0)

        # Common label set used across all metrics
        labels = {
            "http_method": request.method,
            "http_target": http_target,
            "http_status_code": str(status_code),
            "http_scheme": request.url.scheme,
            "http_host": request.headers.get("host", ""),
        }

        # Record metrics
        _duration_histogram.record(duration_ms, labels)
        _request_size_histogram.record(request_content_length, labels)
        _response_size_histogram.record(response_content_length, labels)
        _active_requests_gauge.add(-1, {"http_method": request.method})

        # ----------------------------------------------------------------
        # Enrich the OTel span with resolved route + user context
        # ----------------------------------------------------------------
        if span and span.is_recording():
            attributes = {
                "request.id": request_id,
                "user.id": user_id,
                "http.target": http_target,
                "http.route": http_target,
                "http.method": request.method,
                "http.scheme": request.url.scheme,
                "http.host": request.url.hostname,
                "http.status_code": status_code,
                "http.response.duration_ms": duration_ms,
                "http.client.ip": self._get_client_ip(request),
                "http.user_agent": request.headers.get("user-agent"),
            }

            if request.query_params:
                for key, value in request.query_params.items():
                    if key.lower() not in ("password", "token", "secret", "key"):
                        attributes[f"http.query.{key}"] = value

            add_span_attributes(span, attributes)

            if status_code >= 500:
                span.set_status(Status(StatusCode.ERROR, f"HTTP {status_code}"))
            elif status_code >= 400:
                span.set_status(Status(StatusCode.ERROR, f"HTTP {status_code}"))
            else:
                span.set_status(Status(StatusCode.OK))

        # Pass trace context headers back to client
        if request_id:
            response.headers["X-Request-ID"] = request_id
        trace_id = span.get_span_context().trace_id if span else None
        if trace_id:
            response.headers["X-Trace-ID"] = format(trace_id, "032x")

        return response

    def _extract_user_id(self, request: Request) -> str:
        if hasattr(request.state, "user"):
            user = request.state.user
            if hasattr(user, "id"):
                return str(user.id)
            if isinstance(user, dict):
                return str(user.get("id") or user.get("user_id"))
        return None

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        if request.client:
            return request.client.host
        return "unknown"
