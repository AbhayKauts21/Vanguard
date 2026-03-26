"""Ingestion service — orchestrates the full BookStack→Pinecone pipeline."""

import time
from typing import List, Optional
from datetime import datetime, timezone

from loguru import logger

from app.core.config import settings
from app.core.exceptions import IngestionError
from app.domain.schemas import (
    IngestionResult,
    FullSyncResult,
    SyncStatus,
    SyncStatusResponse,
)
from app.adapters.bookstack_client import bookstack_client as default_bookstack_client
from app.adapters.embedding_client import (
    EmbeddingClient,
    embedding_client as default_embedding_client,
)
from app.adapters.vector_store import vector_store as default_vector_store
from app.services.text_processor import text_processor as default_text_processor


class IngestionService:
    """Orchestrates: fetch → clean → chunk → embed → upsert (SRP)."""

    def __init__(
        self,
        *,
        bookstack_client=default_bookstack_client,
        embedding_client: EmbeddingClient = default_embedding_client,
        vector_store=default_vector_store,
        text_processor=default_text_processor,
    ) -> None:
        self.bookstack_client = bookstack_client
        self.embedding_client = embedding_client
        self.vector_store = vector_store
        self.text_processor = text_processor
        self.status: SyncStatus = SyncStatus.IDLE
        self.last_sync_at: Optional[datetime] = None

    async def ingest_single_page(self, page_id: int) -> IngestionResult:
        """Ingest (or re-ingest) a single BookStack page into Pinecone."""
        logger.info(f"Ingesting page {page_id}...")

        try:
            # 1. Fetch full page from BookStack
            page = await self.bookstack_client.get_page(page_id)

            # 2. Delete existing vectors for this page (idempotent re-ingestion)
            await self.vector_store.delete_by_page_id(page_id)

            # 3. Build BookStack URL for citations
            page_url = f"{settings.BOOKSTACK_URL}{page.url_path}"

            # 4. Process: clean HTML → chunk text
            chunks = self.text_processor.process_page(
                page_id=page.id,
                html_content=page.html,
                page_title=page.name,
                book_id=page.book_id,
                chapter_id=page.chapter_id,
                bookstack_url=page_url,
            )

            if not chunks:
                logger.warning(f"Page {page_id} produced no chunks (empty content?)")
                return IngestionResult(
                    page_id=page_id, page_title=page.name, chunks_created=0
                )

            # 5. Generate embeddings for all chunks
            chunk_texts = [c.text for c in chunks]
            vectors = await self.embedding_client.embed_texts(chunk_texts)

            # 6. Upsert to Pinecone
            ids = [c.chunk_id for c in chunks]
            metadatas = [c.metadata for c in chunks]
            await self.vector_store.upsert_vectors(ids=ids, vectors=vectors, metadatas=metadatas)

            logger.info(f"Page {page_id} '{page.name}': {len(chunks)} chunks ingested")
            return IngestionResult(
                page_id=page_id,
                page_title=page.name,
                chunks_created=len(chunks),
            )

        except Exception as e:
            logger.error(f"Ingestion failed for page {page_id}: {e}")
            raise IngestionError(detail=f"Failed to ingest page {page_id}: {e}")

    async def full_sync(self) -> FullSyncResult:
        """Full re-sync: ingest ALL BookStack pages into Pinecone."""
        start = time.time()
        self.status = SyncStatus.SYNCING
        logger.info("Starting full BookStack → Pinecone sync...")

        try:
            # 1. Fetch all page stubs from BookStack before touching Pinecone.
            # This preserves the current index if BookStack is temporarily unavailable.
            pages = await self.bookstack_client.get_all_pages()

            # 2. Wipe existing vectors for clean re-index only after source fetch succeeds
            await self.vector_store.delete_all()
            total_chunks = 0
            failed: List[int] = []

            # 3. Process each page individually
            for page_stub in pages:
                try:
                    result = await self.ingest_single_page(page_stub.id)
                    total_chunks += result.chunks_created
                except Exception as e:
                    logger.error(f"Skipping page {page_stub.id}: {e}")
                    failed.append(page_stub.id)

            duration = round(time.time() - start, 2)
            self.status = SyncStatus.COMPLETED
            self.last_sync_at = datetime.now(timezone.utc)

            logger.info(
                f"Full sync complete: {len(pages)} pages, {total_chunks} chunks, "
                f"{len(failed)} failures, {duration}s"
            )

            return FullSyncResult(
                total_pages=len(pages),
                pages_processed=len(pages) - len(failed),
                total_chunks=total_chunks,
                failed_pages=failed,
                duration_seconds=duration,
                status=self.status,
            )

        except Exception as e:
            self.status = SyncStatus.FAILED
            logger.error(f"Full sync failed: {e}")
            raise IngestionError(detail=f"Full sync failed: {e}")

    async def delta_sync(self) -> int:
        """Incremental sync: only pages updated since last sync."""
        if not self.last_sync_at:
            logger.info("No previous sync — running full sync instead")
            result = await self.full_sync()
            return result.pages_processed

        self.status = SyncStatus.SYNCING
        timestamp = self.last_sync_at.strftime("%Y-%m-%d %H:%M:%S")
        logger.info(f"Delta sync: fetching pages updated after {timestamp}")

        try:
            updated_pages = await self.bookstack_client.get_pages_updated_after(timestamp)

            if not updated_pages:
                logger.info("Delta sync: no updates found")
                self.status = SyncStatus.COMPLETED
                self.last_sync_at = datetime.now(timezone.utc)
                return 0

            processed = 0
            for page_stub in updated_pages:
                try:
                    await self.ingest_single_page(page_stub.id)
                    processed += 1
                except Exception as e:
                    logger.error(f"Delta sync: failed page {page_stub.id}: {e}")

            self.status = SyncStatus.COMPLETED
            self.last_sync_at = datetime.now(timezone.utc)
            logger.info(f"Delta sync complete: {processed}/{len(updated_pages)} pages")
            return processed

        except Exception as e:
            self.status = SyncStatus.FAILED
            logger.error(f"Delta sync failed: {e}")
            raise IngestionError(detail=f"Delta sync failed: {e}")

    async def delete_page(self, page_id: int) -> None:
        """Remove all vectors for a deleted BookStack page."""
        logger.info(f"Deleting vectors for page {page_id}")
        await self.vector_store.delete_by_page_id(page_id)

    def get_status(self) -> SyncStatusResponse:
        """Return current sync status for admin dashboard."""
        return SyncStatusResponse(
            status=self.status,
            last_sync_at=self.last_sync_at,
        )


# Singleton instance
ingestion_service = IngestionService()
