from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from loguru import logger


# --- Domain Exceptions (Business Logic Errors) ---

class VanguardError(Exception):
    """Base exception for all Vanguard domain errors."""

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class NoContextFoundError(VanguardError):
    """Raised when similarity scores are below the confidence threshold."""

    def __init__(self, detail: str = "No relevant documentation found for your question."):
        super().__init__(detail=detail, status_code=404)


class IngestionError(VanguardError):
    """Raised when data ingestion from BookStack fails."""

    def __init__(self, detail: str = "Failed to ingest BookStack content."):
        super().__init__(detail=detail, status_code=500)


class BookStackConnectionError(VanguardError):
    """Raised when BookStack API is unreachable or returns errors."""

    def __init__(self, detail: str = "Failed to connect to BookStack."):
        super().__init__(detail=detail, status_code=502)


class VectorStoreError(VanguardError):
    """Raised when Pinecone operations fail."""

    def __init__(self, detail: str = "Vector store operation failed."):
        super().__init__(detail=detail, status_code=503)


class EmbeddingError(VanguardError):
    """Raised when OpenAI embedding API call fails."""

    def __init__(self, detail: str = "Failed to generate embeddings."):
        super().__init__(detail=detail, status_code=502)


# --- Exception Handlers (registered in main.py) ---

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handles standard HTTP exceptions in RFC 7807 format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": f"https://httpstatuses.com/{exc.status_code}",
            "title": str(exc.detail),
            "status": exc.status_code,
            "instance": str(request.url),
        },
    )


async def vanguard_exception_handler(request: Request, exc: VanguardError):
    """Handles all domain exceptions in RFC 7807 format."""
    logger.error(f"[{exc.__class__.__name__}] {exc.detail} | path={request.url}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": f"https://httpstatuses.com/{exc.status_code}",
            "title": exc.__class__.__name__,
            "detail": exc.detail,
            "status": exc.status_code,
            "instance": str(request.url),
        },
    )
