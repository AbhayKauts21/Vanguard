import uvicorn
from contextlib import asynccontextmanager
import time
from datetime import datetime

START_TIME = time.time()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.router_chat import router as chat_router
from app.api.router_azure_chat import router as azure_chat_router
from app.api.router_admin import router as admin_router
from app.api.router_webhook import router as webhook_router
from app.core.config import settings
from app.core.exceptions import (
    CleoError,
    http_exception_handler,
    cleo_exception_handler,
)
from app.core.logging import get_request_logger  # noqa: F401 — triggers _setup_logger() early
from app.core.middleware import RequestIdMiddleware
from app.services.sync_scheduler import start_scheduler, stop_scheduler

# ---------------------------------------------------------------------------
# Rate limiter (slowapi) — keyed by client IP
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch auto-sync scheduler. Shutdown: cleanup."""
    logger.info("🧠 CLEO backend starting...")
    start_scheduler()
    yield
    logger.info("🧠 CLEO backend shutting down...")
    stop_scheduler()

    # Close adapter HTTP clients
    from app.adapters.bookstack_client import bookstack_client
    await bookstack_client.close()


def get_application() -> FastAPI:
    _app = FastAPI(
        title=settings.PROJECT_NAME,
        description="CLEO — AI-powered customer support assistant backend",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Rate-limiter state
    _app.state.limiter = limiter
    _app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Request-ID tracing middleware
    _app.add_middleware(RequestIdMiddleware)

    # CORS — restrict origins in production; fallback to localhost for dev
    allowed_origins = [
        origin.strip()
        for origin in settings.ALLOWED_ORIGINS.split(",")
        if origin.strip()
    ]
    _app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # Exception handlers (RFC 7807)
    _app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    _app.add_exception_handler(CleoError, cleo_exception_handler)

    # Routers
    _app.include_router(chat_router, prefix=settings.API_V1_STR)
    _app.include_router(azure_chat_router, prefix=settings.API_V1_STR)
    _app.include_router(admin_router, prefix=settings.API_V1_STR)
    _app.include_router(webhook_router, prefix=settings.API_V1_STR)

    return _app


app = get_application()


@app.get("/health")
async def health():
    """Basic liveness probe."""
    return {"status": "ok", "project": settings.PROJECT_NAME}


@app.get("/health/detailed")
async def detailed_health():
    """Detailed health check for all upstream services."""
    from app.adapters.vector_store import vector_store
    from app.adapters.bookstack_client import bookstack_client
    from app.adapters.llm_client import llm_client
    from app.adapters.azure_openai_client import azure_openai_client
    
    # Check Pinecone
    try:
        stats = await vector_store.get_index_stats()
        pinecone_status = "online"
        vector_count = stats.get("total_vectors", 0)
    except Exception:
        pinecone_status = "offline"
        vector_count = 0

    # Check BookStack
    try:
        books = await bookstack_client.get_books()
        bookstack_status = "online"
        book_count = len(books)
    except Exception:
        bookstack_status = "offline"
        book_count = 0

    # Check OpenAI
    try:
        llm_client._get_client()
        openai_status = "online"
    except Exception:
        openai_status = "offline"

    # Check Azure OpenAI
    try:
        azure_openai_client._get_client()
        azure_status = "online"
    except Exception:
        azure_status = "offline"

    all_online = all(s == "online" for s in [pinecone_status, bookstack_status, openai_status, azure_status])

    return {
        "status": "healthy" if all_online else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "pinecone": {"status": pinecone_status, "vectors": vector_count},
            "bookstack": {"status": bookstack_status, "pages": book_count}, # pages mapped as books proxy
            "openai": {"status": openai_status, "model": settings.OPENAI_MODEL},
            "azure_openai": {"status": azure_status, "deployment": settings.AZURE_OPENAI_CHAT_DEPLOYMENT},
        },
        "metrics": {
            "total_vectors": vector_count,
            "uptime_seconds": time.time() - START_TIME,
        }
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
