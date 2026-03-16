"""OpenAI embedding client — converts text to 1536-dim vectors."""

from typing import List

from loguru import logger

from app.core.config import settings
from app.core.exceptions import EmbeddingError


class EmbeddingClient:
    """Wraps OpenAI embeddings API (Interface Segregation — embedding only)."""

    def __init__(self) -> None:
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self._client = None

    def _get_client(self):
        """Lazy-init OpenAI client to avoid import-time API calls."""
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text string into a vector."""
        return (await self.embed_texts([text]))[0]

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Batch-embed multiple texts. OpenAI supports up to 2048 per call."""
        if not texts:
            return []

        client = self._get_client()
        try:
            # Process in batches of 2048 (OpenAI limit)
            all_embeddings: List[List[float]] = []
            for i in range(0, len(texts), 2048):
                batch = texts[i : i + 2048]
                response = client.embeddings.create(
                    model=self.model,
                    input=batch,
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)

            logger.debug(f"Embedded {len(texts)} texts using {self.model}")
            return all_embeddings

        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            raise EmbeddingError(detail=f"OpenAI embedding failed: {e}")


# Singleton instance
embedding_client = EmbeddingClient()
