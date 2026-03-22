"""API-key authentication for admin endpoints.

Hackathon-grade header-based auth: callers must send
    X-API-Key: <ADMIN_API_KEY>
to access any admin route.  Not production-grade (no rotation,
no JWT, no OAuth) but blocks accidental or casual access.
"""

from fastapi import Header, HTTPException, status


async def verify_admin_key(
    x_api_key: str = Header(
        ...,
        alias="X-API-Key",
        description="Admin API key required for privileged operations.",
    ),
) -> None:
    """FastAPI dependency — raises 403 when the key is wrong or missing."""
    from app.core.config import settings  # deferred to avoid circular import

    if not settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ADMIN_API_KEY is not configured on the server.",
        )

    if x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key.",
        )
