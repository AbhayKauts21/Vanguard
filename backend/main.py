import uvicorn
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router_chat import router as chat_router
from app.api.router_azure_chat import router as azure_chat_router
from app.api.router_admin import router as admin_router
from app.api.router_webhook import router as webhook_router
from app.core.config import settings
from app.core.exceptions import (
    VanguardError,
    http_exception_handler,
    vanguard_exception_handler,
)
from app.services.sync_scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch auto-sync scheduler. Shutdown: cleanup."""
    logger.info("🛡️ Vanguard backend starting...")
    start_scheduler()
    yield
    logger.info("🛡️ Vanguard backend shutting down...")
    stop_scheduler()

    # Close adapter HTTP clients
    from app.adapters.bookstack_client import bookstack_client
    await bookstack_client.close()


def get_application() -> FastAPI:
    _app = FastAPI(
        title=settings.PROJECT_NAME,
        description="AI-powered customer support assistant backend",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS
    _app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers (RFC 7807)
    _app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    _app.add_exception_handler(VanguardError, vanguard_exception_handler)

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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
