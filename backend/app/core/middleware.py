"""Custom middleware — request-id tracing for structured log correlation."""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a unique ``X-Request-Id`` to every request/response cycle.

    The ID is:
    * stored in ``request.state.request_id`` (available to handlers)
    * echoed back in the ``X-Request-Id`` response header (for client-side correlation)
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response
