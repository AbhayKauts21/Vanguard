"""Embedding provider interface used by ingestion and RAG services."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List


class EmbeddingProvider(ABC):
    """Abstract strategy interface for embedding generation."""

    provider_name: str
    model_name: str
    dimensions: int

    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text string."""

    @abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple text strings."""

    def describe(self) -> Dict[str, Any]:
        """Return runtime metadata useful for health checks and diagnostics."""
        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "dimensions": self.dimensions,
        }

    def reset_client(self) -> None:
        """Allow tests or reload paths to reset SDK state."""
        return None
