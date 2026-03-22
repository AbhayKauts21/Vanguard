"""Structured logging configuration for CLEO backend.

Uses loguru with JSON serialization for every RAG pipeline step.
Each log line includes the ``request_id`` (from RequestIdMiddleware)
so entries can be correlated across a single user interaction.

Structured logs are parseable by Datadog, Grafana Loki, ELK, etc.
"""

import sys
import time
from contextlib import asynccontextmanager
from typing import Any

from loguru import logger
from starlette.requests import Request


def _setup_logger() -> None:
    """Configure loguru for structured JSON output in production,
    human-readable in development.
    """
    from app.core.config import settings

    logger.remove()  # Remove default stderr handler

    if settings.DEBUG:
        # Dev: pretty colored output
        logger.add(
            sys.stderr,
            level="DEBUG",
            format=(
                "<green>{time:HH:mm:ss.SSS}</green> | "
                "<level>{level: <7}</level> | "
                "<cyan>{extra[request_id]:>12}</cyan> | "
                "<level>{message}</level>"
            ),
            colorize=True,
        )
    else:
        # Production: JSON logs for aggregation
        logger.add(
            sys.stderr,
            level="INFO",
            serialize=True,  # Full JSON output
        )


def get_request_logger(request: Request | None = None) -> Any:
    """Return a logger instance bound to the current ``request_id``.

    Usage in any handler / service:
        rlog = get_request_logger(request)
        rlog.info("rag.embed_query", query_length=45)
    """
    request_id = "no-req"
    if request and hasattr(request, "state") and hasattr(request.state, "request_id"):
        request_id = request.state.request_id
    return logger.bind(request_id=request_id)


@asynccontextmanager
async def log_pipeline_step(step_name: str, request: Request | None = None, **kw: Any):
    """Async context manager that logs the start and duration of a pipeline step.

    Usage:
        async with log_pipeline_step("rag.vector_search", request, top_k=5):
            results = await vector_store.query(...)
    """
    rlog = get_request_logger(request)
    rlog.info(f"{step_name}.start", **kw)
    t0 = time.perf_counter()
    try:
        yield rlog
    finally:
        duration_ms = round((time.perf_counter() - t0) * 1000, 1)
        rlog.info(f"{step_name}.done", duration_ms=duration_ms, **kw)


# Run setup on import so loguru is configured immediately
_setup_logger()
