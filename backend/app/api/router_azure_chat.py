"""Direct Azure OpenAI chat router.

Phase 7: rate-limited to ``RATE_LIMIT_PER_MINUTE`` requests per client IP.
"""

from fastapi import APIRouter, Request

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging import get_logger
from app.domain.schemas import AzureChatRequest, AzureChatResponse
from app.services.azure_chat_service import azure_chat_service

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/azure-chat", tags=["azure-chat"])

_rate = f"{settings.RATE_LIMIT_PER_MINUTE}/minute"


@router.post("/", response_model=AzureChatResponse)
@limiter.limit(_rate)
async def create_azure_chat(request: Request, body: AzureChatRequest) -> AzureChatResponse:
    """Create a direct synchronous Azure OpenAI chat response."""
    get_logger(request).info(
        "Azure direct chat request received: conversation_id={}".format(
            body.conversation_id or "none"
        )
    )
    return await azure_chat_service.create_chat(body)
