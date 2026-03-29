import uvicorn
from contextlib import asynccontextmanager
import time
from datetime import datetime
import os

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
from app.api.router_auth import router as auth_router
from app.api.router_bookstack import router as bookstack_router
from app.api.router_chats import router as chats_router
from app.api.router_documents import router as documents_router
from app.api.router_rbac import router as rbac_router
from app.api.router_voice import router as voice_router
from app.api.router_webhook import router as webhook_router
from app.api.router_system import router as system_router
from app.core.config import settings
from app.core.exceptions import (
    CleoError,
    http_exception_handler,
    cleo_exception_handler,
)
from app.core.logging import get_request_logger  # noqa: F401 — triggers _setup_logger() early
from app.core.middleware import RequestIdMiddleware
from app.core.structured_logging import configure_structured_logging

from app.services.sync_scheduler import start_scheduler, stop_scheduler

# ---------------------------------------------------------------------------
# Initialize OpenTelemetry BEFORE anything else
# ---------------------------------------------------------------------------
OTEL_ENABLED = os.getenv("OTEL_ENABLED", "false").lower() in ("true", "1", "yes")
TelemetryMiddleware = None
instrument_fastapi = None
instrument_httpx = None

if OTEL_ENABLED:
    try:
        from app.core.telemetry import (
            OpenTelemetryConfig,
            initialize_opentelemetry,
            instrument_fastapi,
            instrument_httpx,
        )
        from app.core.telemetry_middleware import TelemetryMiddleware

        otel_config = OpenTelemetryConfig(
            service_name=os.getenv("OTEL_SERVICE_NAME", "cleo-backend"),
            service_version=os.getenv("SERVICE_VERSION", "1.0.0"),
            environment=os.getenv("ENVIRONMENT", "development"),
            otlp_endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"),
            enable_console_exporter=os.getenv("OTEL_CONSOLE_EXPORTER", "false").lower() in ("true", "1"),
        )
        initialize_opentelemetry(otel_config)
        instrument_httpx()

        # Configure structured JSON logging
        configure_structured_logging(
            level=os.getenv("LOG_LEVEL", "INFO"),
            json_format=os.getenv("LOG_FORMAT", "json") == "json",
        )

        logger.info("[OTEL] Observability initialized")
    except ModuleNotFoundError:
        OTEL_ENABLED = False
        logger.warning("[OTEL] Optional OpenTelemetry dependencies are not installed; telemetry disabled")

# ---------------------------------------------------------------------------
# Rate limiter (slowapi) — keyed by client IP
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch auto-sync scheduler. Shutdown: cleanup."""
    startup_logger = logger.bind(request_id="startup")
    startup_logger.info("🧠 CLEO backend starting...")
    start_scheduler()
    yield
    shutdown_logger = logger.bind(request_id="shutdown")
    shutdown_logger.info("🧠 CLEO backend shutting down...")
    stop_scheduler()

    # Close adapter HTTP clients
    from app.adapters.bookstack_client import bookstack_client
    from app.adapters.azure_blob_storage import azure_blob_storage
    from app.db.session import dispose_engine
    await bookstack_client.close()
    await azure_blob_storage.close()
    await dispose_engine()


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

    # OpenTelemetry FastAPI instrumentation
    if OTEL_ENABLED and instrument_fastapi and TelemetryMiddleware:
        instrument_fastapi(_app)
        # Add telemetry middleware for custom attributes
        _app.add_middleware(TelemetryMiddleware)

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
        allow_methods=["GET", "POST", "DELETE", "PATCH"],
        allow_headers=["*"],
    )

    # Exception handlers (RFC 7807)
    _app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    _app.add_exception_handler(CleoError, cleo_exception_handler)

    # Routers
    _app.include_router(chat_router, prefix=settings.API_V1_STR)
    _app.include_router(azure_chat_router, prefix=settings.API_V1_STR)
    _app.include_router(auth_router, prefix=settings.API_V1_STR)
    _app.include_router(bookstack_router, prefix=settings.API_V1_STR)
    _app.include_router(chats_router, prefix=settings.API_V1_STR)
    _app.include_router(documents_router, prefix=settings.API_V1_STR)
    _app.include_router(rbac_router, prefix=settings.API_V1_STR)
    _app.include_router(admin_router, prefix=settings.API_V1_STR)
    _app.include_router(voice_router, prefix=settings.API_V1_STR)
    _app.include_router(webhook_router, prefix=settings.API_V1_STR)
    _app.include_router(system_router, prefix=settings.API_V1_STR)

    return _app


app = get_application()


@app.get("/health")
async def health():
    """Basic liveness probe."""
    return {"status": "ok", "project": settings.PROJECT_NAME}


@app.get("/health/detailed")
async def detailed_health():
    """Detailed health check for all upstream services."""
    from app.adapters.embedding_client import embedding_client
    from app.adapters.vector_store import vector_store
    from app.adapters.llm_client import llm_client
    from app.db.session import check_database_health
    from app.db.session import get_session_factory
    from app.repositories.document_repository import document_repository
    from app.services.document_sync_service import document_sync_service
    
    # Check Pinecone
    try:
        stats = await vector_store.get_index_stats()
        pinecone_status = "online"
        vector_count = stats.get("namespace_vectors") or stats.get("total_vectors", 0)
    except Exception:
        pinecone_status = "offline"
        vector_count = 0

    # Check embedding provider
    try:
        embedding_metadata = embedding_client.describe()
        provider = embedding_client.provider
        if hasattr(provider, "_get_client"):
            provider._get_client()
        embedding_status = "online"
    except Exception:
        embedding_status = "offline"
        embedding_metadata = {
            "provider": "azure",
            "model": settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            "dimensions": settings.EMBEDDING_DIMENSIONS,
        }

    # Check BookStack / default document source
    try:
        source_health = await document_sync_service.get_source_health(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
        )
        bookstack_status = "online" if source_health["healthy"] else "offline"
        async with get_session_factory()() as session:
            source = await document_repository.get_source_by_key(
                session,
                settings.BOOKSTACK_SOURCE_KEY,
            )
            bookstack_pages = (
                await document_repository.count_active_documents_for_source(session, source.id)
                if source is not None
                else 0
            )
    except Exception:
        source_health = {
            "source_key": settings.BOOKSTACK_SOURCE_KEY,
            "provider_type": "bookstack",
            "last_sync_status": "idle",
            "last_sync_at": None,
        }
        bookstack_status = "offline"
        bookstack_pages = 0

    # Check Azure generation
    try:
        llm_client._get_client()
        azure_generation_status = "online"
    except Exception:
        azure_generation_status = "offline"

    # Check Postgres
    try:
        database_online = await check_database_health()
        database_status = "online" if database_online else "offline"
    except Exception:
        database_status = "offline"

    all_online = all(
        s == "online"
        for s in [
            pinecone_status,
            bookstack_status,
            embedding_status,
            azure_generation_status,
            database_status,
        ]
    )

    return {
        "status": "healthy" if all_online else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "pinecone": {"status": pinecone_status, "vectors": vector_count},
            "bookstack": {
                "status": bookstack_status,
                "pages": bookstack_pages,
                "source_key": source_health["source_key"],
                "provider_type": source_health["provider_type"],
                "last_sync_status": source_health["last_sync_status"],
                "last_sync_at": source_health["last_sync_at"],
            },
            "embeddings": {"status": embedding_status, **embedding_metadata},
            "azure_openai": {
                "status": azure_generation_status,
                "chat_deployment": settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
                "embedding_deployment": settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            },
            "postgres": {"status": database_status, "database": settings.POSTGRES_DB},
        },
        "metrics": {
            "total_vectors": vector_count,
            "uptime_seconds": time.time() - START_TIME,
        }
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
