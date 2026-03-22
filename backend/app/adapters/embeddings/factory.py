"""Factory helpers for resolving the active embedding provider."""

from app.adapters.embeddings.azure_provider import AzureEmbeddingProvider
from app.adapters.embeddings.base import EmbeddingProvider

_embedding_provider: EmbeddingProvider | None = None


def build_embedding_provider() -> EmbeddingProvider:
    """Create the single supported Azure embedding provider."""
    return AzureEmbeddingProvider()


def get_embedding_provider() -> EmbeddingProvider:
    """Return the lazily-initialized embedding provider singleton."""
    global _embedding_provider
    if _embedding_provider is None:
        _embedding_provider = build_embedding_provider()
    return _embedding_provider


def reset_embedding_provider() -> None:
    """Reset the global provider singleton, primarily for tests."""
    global _embedding_provider
    if _embedding_provider is not None:
        _embedding_provider.reset_client()
    _embedding_provider = None
