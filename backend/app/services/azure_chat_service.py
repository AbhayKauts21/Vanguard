"""Service layer for stateless direct Azure OpenAI chat."""

from typing import Any, Dict, List, Optional, Protocol, Sequence

from app.adapters.azure_openai_client import azure_openai_client
from app.core.azure_prompts import build_azure_chat_messages
from app.core.config import settings
from app.domain.schemas import (
    AzureChatMessage,
    AzureChatRequest,
    AzureChatResponse,
    AzureChatUsage,
)


class AzureChatMiddleware(Protocol):
    """Lifecycle hooks for extending the Azure direct-chat pipeline."""

    async def before_request(
        self, request: AzureChatRequest, messages: Sequence[AzureChatMessage]
    ) -> None:
        ...

    async def after_response(
        self,
        request: AzureChatRequest,
        messages: Sequence[AzureChatMessage],
        raw_response: Any,
        response: AzureChatResponse,
    ) -> None:
        ...

    async def on_error(
        self,
        request: AzureChatRequest,
        messages: Sequence[AzureChatMessage],
        error: Exception,
    ) -> None:
        ...


class AzureChatService:
    """Coordinates request shaping, middleware, Azure call, and normalization."""

    def __init__(self) -> None:
        self._middlewares: List[AzureChatMiddleware] = []

    def register_middleware(self, middleware: AzureChatMiddleware) -> None:
        """Allow custom hooks to wrap the Azure chat lifecycle."""
        self._middlewares.append(middleware)

    def clear_middlewares(self) -> None:
        """Remove all registered middleware hooks, mainly for tests."""
        self._middlewares.clear()

    async def create_chat(self, request: AzureChatRequest) -> AzureChatResponse:
        """Execute a stateless direct chat call against Azure OpenAI."""
        messages = build_azure_chat_messages(request)

        try:
            for middleware in self._middlewares:
                await middleware.before_request(request, messages)

            raw_response = await azure_openai_client.create_chat_completion(
                messages,
                temperature=request.params.temperature,
                max_tokens=request.params.max_tokens,
            )

            response = self._normalize_response(request, raw_response)

            for middleware in self._middlewares:
                await middleware.after_response(
                    request, messages, raw_response, response
                )

            return response
        except Exception as exc:
            for middleware in self._middlewares:
                await middleware.on_error(request, messages, exc)
            raise

    def _normalize_response(
        self, request: AzureChatRequest, raw_response: Any
    ) -> AzureChatResponse:
        """Map SDK response objects into stable API DTOs."""
        output_text = ""
        if getattr(raw_response, "choices", None):
            output_text = raw_response.choices[0].message.content or ""

        usage = getattr(raw_response, "usage", None)
        normalized_usage: Optional[AzureChatUsage] = None
        if usage is not None:
            normalized_usage = AzureChatUsage(
                prompt_tokens=getattr(usage, "prompt_tokens", None),
                completion_tokens=getattr(usage, "completion_tokens", None),
                total_tokens=getattr(usage, "total_tokens", None),
            )

        request_id = getattr(raw_response, "_request_id", None)
        metadata: Dict[str, Any] = {}
        if request.metadata:
            metadata["request_metadata"] = request.metadata
        if settings.AZURE_OPENAI_API_VERSION:
            metadata["api_version"] = settings.AZURE_OPENAI_API_VERSION

        return AzureChatResponse(
            conversation_id=request.conversation_id,
            output_text=output_text,
            deployment=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            request_id=request_id,
            usage=normalized_usage,
            metadata=metadata,
        )


azure_chat_service = AzureChatService()
