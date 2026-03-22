"""Azure OpenAI embedding provider implementation."""

from typing import Any, Dict, List

from loguru import logger

from app.adapters.embeddings.base import EmbeddingProvider
from app.core.config import (
    build_azure_openai_base_url,
    settings,
    validate_azure_embedding_settings,
)
from app.core.exceptions import EmbeddingError


class AzureEmbeddingProvider(EmbeddingProvider):
    """Wrap Azure OpenAI embeddings using the OpenAI SDK endpoint format."""

    provider_name = "azure"

    def __init__(self) -> None:
        self.model_name = settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self._client = None

    def _get_client(self):
        """Lazy-init the Azure OpenAI SDK client."""
        validate_azure_embedding_settings(settings)

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
        self._client = None

    async def embed_text(self, text: str) -> List[float]:
        return (await self.embed_texts([text]))[0]

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        client = self._get_client()
        try:
            all_embeddings: List[List[float]] = []
            for i in range(0, len(texts), 2048):
                batch = texts[i : i + 2048]
                response = client.embeddings.create(
                    model=self.model_name,
                    input=batch,
                    dimensions=self.dimensions,
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)

            logger.debug(
                "Embedded {} texts using Azure deployment '{}'".format(
                    len(texts), self.model_name
                )
            )
            return all_embeddings

        except Exception as exc:
            logger.error(f"Azure embedding failed: {exc}")
            raise EmbeddingError(detail=f"Azure embedding failed: {exc}") from exc

    def describe(self) -> Dict[str, Any]:
        metadata = super().describe()
        metadata["deployment"] = self.model_name
        metadata["endpoint"] = settings.AZURE_OPENAI_ENDPOINT
        return metadata
