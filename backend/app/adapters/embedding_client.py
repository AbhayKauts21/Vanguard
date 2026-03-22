"""Embedding facade that resolves the configured provider at runtime."""

from typing import Any, Dict, List

from app.adapters.embeddings.base import EmbeddingProvider
from app.adapters.embeddings.factory import (
    get_embedding_provider,
    reset_embedding_provider,
)


class EmbeddingClient:
    """Thin facade over the active embedding provider strategy."""

    def __init__(self, provider: EmbeddingProvider | None = None) -> None:
        self._provider = provider

    @property
    def provider(self) -> EmbeddingProvider:
        """Resolve the injected provider or the configured singleton."""
        return self._provider or get_embedding_provider()

    @property
    def model(self) -> str:
        return self.provider.model_name

    @property
    def dimensions(self) -> int:
        return self.provider.dimensions

    @property
    def provider_name(self) -> str:
        return self.provider.provider_name

    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text string into a vector."""
        return await self.provider.embed_text(text)

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Batch-embed multiple texts."""
        return await self.provider.embed_texts(texts)

    def describe(self) -> Dict[str, Any]:
        """Surface provider metadata for health and diagnostics."""
        return self.provider.describe()

    def reset(self) -> None:
        """Reset cached provider state."""
        if self._provider is not None:
            self._provider.reset_client()
            return
        reset_embedding_provider()


# Singleton instance
embedding_client = EmbeddingClient()
