"""Pinecone vector store adapter — upsert, query, delete vectors."""

from typing import List, Dict, Optional

from loguru import logger

from app.core.config import settings
from app.core.exceptions import VectorStoreError
from app.domain.schemas import VectorSearchResult


class VectorStore:
    """Manages all Pinecone index operations (Single Responsibility)."""

    NAMESPACE = settings.DOCUMENT_VECTOR_NAMESPACE

    def __init__(self) -> None:
        self._index = None
        self.expected_dimensions = settings.EMBEDDING_DIMENSIONS

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
            self._validate_batch_dimensions(vectors)
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
            self._validate_vector_dimension(vector, context="query")
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
                    bookstack_url=match.get("metadata", {}).get("bookstack_url", "")
                    or match.get("metadata", {}).get("source_url", ""),
                    source_url=match.get("metadata", {}).get("source_url", "")
                    or match.get("metadata", {}).get("bookstack_url", ""),
                    book_id=match.get("metadata", {}).get("book_id", 0),
                    document_uid=match.get("metadata", {}).get("document_uid", ""),
                    external_document_id=match.get("metadata", {}).get("external_document_id", ""),
                    source_key=match.get("metadata", {}).get("source_key", ""),
                    source_type=match.get("metadata", {}).get("source_type", "bookstack"),
                    source_name=match.get("metadata", {}).get("source_name", ""),
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
            if self._is_missing_namespace_error(e):
                logger.info(
                    "Pinecone namespace '{}' does not exist yet; delete_by_page_id is a no-op".format(
                        self.NAMESPACE
                    )
                )
                return
            logger.error(f"Pinecone delete failed for page {page_id}: {e}")
            raise VectorStoreError(detail=f"Failed to delete vectors for page {page_id}: {e}")

    async def delete_by_document_uid(self, document_uid: str) -> None:
        """Delete all chunks for a provider-agnostic document UID."""
        index = self._get_index()
        try:
            index.delete(
                filter={"document_uid": {"$eq": document_uid}},
                namespace=self.NAMESPACE,
            )
            logger.info(f"Deleted vectors for document_uid={document_uid}")
        except Exception as e:
            if self._is_missing_namespace_error(e):
                logger.info(
                    "Pinecone namespace '{}' does not exist yet; delete_by_document_uid is a no-op".format(
                        self.NAMESPACE
                    )
                )
                return
            logger.error(f"Pinecone delete failed for document_uid {document_uid}: {e}")
            raise VectorStoreError(detail=f"Failed to delete vectors for document_uid {document_uid}: {e}")

    async def delete_all(self) -> None:
        """Wipe entire namespace (used for full re-sync)."""
        index = self._get_index()
        try:
            index.delete(delete_all=True, namespace=self.NAMESPACE)
            logger.info("Deleted ALL vectors from Pinecone namespace")
        except Exception as e:
            if self._is_missing_namespace_error(e):
                logger.info(
                    "Pinecone namespace '{}' does not exist yet; delete_all is a no-op".format(
                        self.NAMESPACE
                    )
                )
                return
            logger.error(f"Pinecone delete_all failed: {e}")
            raise VectorStoreError(detail=f"Failed to clear vector store: {e}")

    async def delete_by_source_type(self, source_type: str) -> None:
        """Delete all vectors for a specific source type within the namespace."""
        index = self._get_index()
        try:
            index.delete(
                filter={"source_type": {"$eq": source_type}},
                namespace=self.NAMESPACE,
            )
            logger.info("Deleted vectors for source_type='{}'", source_type)
        except Exception as e:
            if self._is_missing_namespace_error(e):
                logger.info(
                    "Pinecone namespace '{}' does not exist yet; delete_by_source_type is a no-op".format(
                        self.NAMESPACE
                    )
                )
                return
            logger.error(f"Pinecone delete_by_source_type failed for {source_type}: {e}")
            raise VectorStoreError(
                detail=f"Failed to delete vectors for source_type '{source_type}': {e}"
            )

    async def get_index_stats(self) -> Dict:
        """Return index stats (total vector count, etc.)."""
        index = self._get_index()
        try:
            stats = index.describe_index_stats()
            namespaces = stats.get("namespaces", {}) or {}
            namespace_total = 0

            for namespace_name, namespace_stats in namespaces.items():
                vector_count = (
                    namespace_stats.get("vector_count")
                    or namespace_stats.get("record_count")
                    or 0
                )
                if namespace_name == self.NAMESPACE:
                    namespace_total = int(vector_count)
                    break

            total_vectors = int(stats.get("total_vector_count", 0) or 0)
            if namespace_total > 0:
                total_vectors = namespace_total

            return {
                "total_vectors": total_vectors,
                "namespace_vectors": namespace_total,
                "namespaces": namespaces,
                "expected_dimensions": self.expected_dimensions,
            }
        except Exception as e:
            logger.error(f"Pinecone stats failed: {e}")
            return {
                "total_vectors": 0,
                "namespace_vectors": 0,
                "namespaces": {},
                "expected_dimensions": self.expected_dimensions,
            }

    def _validate_batch_dimensions(self, vectors: List[List[float]]) -> None:
        """Ensure all vectors match the configured embedding dimensions."""
        for index, vector in enumerate(vectors):
            self._validate_vector_dimension(vector, context=f"upsert[{index}]")

    def _validate_vector_dimension(self, vector: List[float], *, context: str) -> None:
        """Fail fast if vector length does not match the configured index contract."""
        if not vector:
            raise VectorStoreError(detail=f"Empty vector received during {context}.")
        if len(vector) != self.expected_dimensions:
            raise VectorStoreError(
                detail=(
                    f"Vector dimension mismatch during {context}: "
                    f"got {len(vector)}, expected {self.expected_dimensions}."
                )
            )

    def _is_missing_namespace_error(self, error: Exception) -> bool:
        """Treat Pinecone's missing-namespace response as an idempotent empty state."""
        message = str(error).lower()
        return "namespace not found" in message


# Singleton instance
vector_store = VectorStore()
