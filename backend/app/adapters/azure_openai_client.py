"""Azure OpenAI Foundry client for direct synchronous chat."""

from typing import Any, Dict, List, Optional, Sequence

import httpx
from loguru import logger

from app.core.config import (
    build_azure_openai_base_url,
    settings,
    validate_azure_openai_settings,
)
from app.core.exceptions import AzureOpenAIError, AzureOpenAITimeoutError
from app.domain.schemas import AzureChatMessage


class AzureOpenAIClient:
    """Wraps Azure OpenAI chat completions using the OpenAI SDK."""

    def __init__(self) -> None:
        self._client = None

    def _get_client(self):
        """Lazy-init the Azure OpenAI SDK client."""
        validate_azure_openai_settings(settings)

        if self._client is None:
            from openai import OpenAI

            client_options: Dict[str, Any] = {
                "api_key": settings.AZURE_OPENAI_API_KEY,
                "base_url": build_azure_openai_base_url(settings.AZURE_OPENAI_ENDPOINT),
                "timeout": settings.AZURE_OPENAI_TIMEOUT_SECONDS,
                "max_retries": settings.AZURE_OPENAI_MAX_RETRIES,
            }
            if settings.AZURE_OPENAI_API_VERSION:
                client_options["default_query"] = {
                    "api-version": settings.AZURE_OPENAI_API_VERSION
                }

            self._client = OpenAI(**client_options)

        return self._client

    def reset_client(self) -> None:
        """Reset the lazy client, mainly for tests or config reloads."""
        self._client = None

    async def create_chat_completion(
        self,
        messages: Sequence[AzureChatMessage],
        *,
        temperature: float,
        max_tokens: Optional[int],
    ):
        """Send a synchronous chat completion request to Azure OpenAI."""
        client = self._get_client()
        payload: Dict[str, Any] = {
            "model": settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            "temperature": temperature,
            "messages": [message.model_dump() for message in messages],
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        try:
            response = client.chat.completions.create(**payload)
            logger.info(
                "Azure direct chat completed using deployment '{}'".format(
                    settings.AZURE_OPENAI_CHAT_DEPLOYMENT
                )
            )
            return response
        except httpx.TimeoutException as exc:
            logger.error(f"Azure OpenAI timeout: {exc}")
            raise AzureOpenAITimeoutError(
                detail=f"Azure OpenAI request timed out: {exc}"
            ) from exc
        except Exception as exc:
            if exc.__class__.__name__ == "APITimeoutError":
                logger.error(f"Azure OpenAI timeout: {exc}")
                raise AzureOpenAITimeoutError(
                    detail=f"Azure OpenAI request timed out: {exc}"
                ) from exc
            logger.error(f"Azure OpenAI request failed: {exc}")
            raise AzureOpenAIError(detail=f"Azure OpenAI request failed: {exc}") from exc


azure_openai_client = AzureOpenAIClient()
