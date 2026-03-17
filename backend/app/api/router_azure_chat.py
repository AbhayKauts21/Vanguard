"""Direct Azure OpenAI chat router."""

from fastapi import APIRouter
from loguru import logger

from app.domain.schemas import AzureChatRequest, AzureChatResponse
from app.services.azure_chat_service import azure_chat_service

router = APIRouter(prefix="/azure-chat", tags=["azure-chat"])


@router.post("/", response_model=AzureChatResponse)
async def create_azure_chat(request: AzureChatRequest) -> AzureChatResponse:
    """Create a direct synchronous Azure OpenAI chat response."""
    logger.info(
        "Azure direct chat request received: conversation_id={}".format(
            request.conversation_id or "none"
        )
    )
    return await azure_chat_service.create_chat(request)
