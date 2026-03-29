"""Azure OpenAI Foundry client for direct synchronous chat."""

from collections.abc import Iterator
from typing import Any, Dict, List, Optional, Sequence

import httpx
from loguru import logger

from app.core.config import (
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
            from openai import AzureOpenAI

            client_options: Dict[str, Any] = {
                "api_key": settings.AZURE_OPENAI_API_KEY,
                "azure_endpoint": settings.AZURE_OPENAI_ENDPOINT,
                "api_version": settings.AZURE_OPENAI_API_VERSION,
                "timeout": settings.AZURE_OPENAI_TIMEOUT_SECONDS,
                "max_retries": settings.AZURE_OPENAI_MAX_RETRIES,
            }

            self._client = AzureOpenAI(**client_options)

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
        deployment = settings.AZURE_OPENAI_CHAT_DEPLOYMENT
        
        payload: Dict[str, Any] = {
            "model": deployment,
            "messages": [message.model_dump() for message in messages],
        }
        
        # Modern Azure models (like gpt-5.3/o1) have strict parameter requirements:
        # 1. They use max_completion_tokens instead of max_tokens.
        # 2. They often only support temperature=1.0 (some block the parameter entirely if not 1).
        if "gpt-5.3" in deployment or "o1" in deployment:
            if max_tokens is not None:
                payload["max_completion_tokens"] = max_tokens
            # Do not set temperature for these models (defaults to 1.0)
        else:
            payload["temperature"] = temperature
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens

        try:
            response = client.chat.completions.create(**payload)
            logger.info(
                "Azure direct chat completed using deployment '{}'".format(deployment)
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

    async def stream_chat_completion(
        self,
        messages: Sequence[AzureChatMessage],
        *,
        temperature: float,
        max_tokens: Optional[int] = None,
    ):
        """Stream a chat completion from Azure OpenAI."""
        client = self._get_client()
        deployment = settings.AZURE_OPENAI_CHAT_DEPLOYMENT
        
        payload: Dict[str, Any] = {
            "model": deployment,
            "stream": True,
            "messages": [message.model_dump() for message in messages],
        }

        # Handle modern model parameters
        if "gpt-5.3" in deployment or "o1" in deployment:
            if max_tokens is not None:
                payload["max_completion_tokens"] = max_tokens
        else:
            payload["temperature"] = temperature
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens

        try:
            stream = client.chat.completions.create(**payload)
            for chunk in stream:
                for text_delta in self._iter_text_deltas(chunk):
                    yield text_delta
        except Exception as exc:
            logger.error(f"Azure OpenAI stream failed: {exc}")
            raise AzureOpenAIError(detail=f"Azure stream failed: {exc}") from exc

    def _iter_text_deltas(self, chunk: Any) -> Iterator[str]:
        """Yield text deltas from an Azure stream chunk, tolerating empty choices."""
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            return

        delta = getattr(choices[0], "delta", None)
        if delta is None:
            return

        content = getattr(delta, "content", None)
        if not content:
            return

        if isinstance(content, str):
            yield content
            return

        if isinstance(content, list):
            for part in content:
                text = getattr(part, "text", None)
                if text:
                    yield text
                    continue
                if isinstance(part, dict):
                    dict_text = part.get("text")
                    if dict_text:
                        yield dict_text


azure_openai_client = AzureOpenAIClient()
