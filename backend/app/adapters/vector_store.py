"""Pinecone vector store adapter — upsert, query, delete vectors."""

from typing import List, Dict, Optional

from loguru import logger

from app.core.config import settings
from app.core.exceptions import VectorStoreError
from app.domain.schemas import VectorSearchResult


class VectorStore:
    """Manages all Pinecone index operations (Single Responsibility)."""

    NAMESPACE = "bookstack"

    def __init__(self) -> None:
        self._index = None

    def _get_index(self):
        """Lazy-init Pinecone index connection."""
        if self._index is None:
            from pinecone import Pinecone

            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            self._index = pc.Index(settings.PINECONE_INDEX_NAME)
            logger.info(f"Connected to Pinecone index: {settings.PINECONE_INDEX_NAME}")
        return self._index

    async def upsert_vectors(
        self,
        ids: List[str],
        vectors: List[List[float]],
        metadatas: List[Dict],
    ) -> int:
        """Upsert vectors with metadata into Pinecone. Returns upserted count."""
        index = self._get_index()
        try:
            # Pinecone accepts list of (id, vector, metadata) tuples
            records = [
                {"id": vid, "values": vec, "metadata": meta}
                for vid, vec, meta in zip(ids, vectors, metadatas)
            ]

            # Upsert in batches of 100 (Pinecone recommended)
            upserted = 0
            for i in range(0, len(records), 100):
                batch = records[i : i + 100]
                index.upsert(vectors=batch, namespace=self.NAMESPACE)
                upserted += len(batch)

            logger.info(f"Upserted {upserted} vectors to Pinecone")
            return upserted

        except Exception as e:
            logger.error(f"Pinecone upsert failed: {e}")
            raise VectorStoreError(detail=f"Failed to upsert vectors: {e}")

    async def query(
        self,
        vector: List[float],
        top_k: int = 5,
        filter_dict: Optional[Dict] = None,
    ) -> List[VectorSearchResult]:
        """Similarity search — returns top_k closest chunks with scores."""
        index = self._get_index()
        try:
            query_params = {
                "vector": vector,
                "top_k": top_k,
                "include_metadata": True,
                "namespace": self.NAMESPACE,
            }
            if filter_dict:
                query_params["filter"] = filter_dict

            results = index.query(**query_params)

            return [
                VectorSearchResult(
                    chunk_id=match["id"],
                    score=match["score"],
                    text=match.get("metadata", {}).get("chunk_text", ""),
                    page_id=match.get("metadata", {}).get("page_id", 0),
                    page_title=match.get("metadata", {}).get("page_title", ""),
                    bookstack_url=match.get("metadata", {}).get("bookstack_url", ""),
                    book_id=match.get("metadata", {}).get("book_id", 0),
                )
                for match in results.get("matches", [])
            ]

        except Exception as e:
            logger.error(f"Pinecone query failed: {e}")
            raise VectorStoreError(detail=f"Similarity search failed: {e}")

    async def delete_by_page_id(self, page_id: int) -> None:
        """Delete all chunks for a specific BookStack page."""
        index = self._get_index()
        try:
            index.delete(
                filter={"page_id": {"$eq": page_id}},
                namespace=self.NAMESPACE,
            )
            logger.info(f"Deleted vectors for page_id={page_id}")
        except Exception as e:
            logger.error(f"Pinecone delete failed for page {page_id}: {e}")
            raise VectorStoreError(detail=f"Failed to delete vectors for page {page_id}: {e}")

    async def delete_all(self) -> None:
        """Wipe entire namespace (used for full re-sync)."""
        index = self._get_index()
        try:
            index.delete(delete_all=True, namespace=self.NAMESPACE)
            logger.info("Deleted ALL vectors from Pinecone namespace")
        except Exception as e:
            logger.error(f"Pinecone delete_all failed: {e}")
            raise VectorStoreError(detail=f"Failed to clear vector store: {e}")

    async def get_index_stats(self) -> Dict:
        """Return index stats (total vector count, etc.)."""
        index = self._get_index()
        try:
            stats = index.describe_index_stats()
            return {
                "total_vectors": stats.get("total_vector_count", 0),
                "namespaces": stats.get("namespaces", {}),
            }
        except Exception as e:
            logger.error(f"Pinecone stats failed: {e}")
            return {"total_vectors": 0, "namespaces": {}}


# Singleton instance
vector_store = VectorStore()
