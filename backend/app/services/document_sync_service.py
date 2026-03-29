"""Provider-agnostic orchestration for document source sync and indexing."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from zlib import crc32

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.document_providers import BookStackProvider, DocumentProvider
from app.adapters.embedding_client import (
    EmbeddingClient,
    embedding_client as default_embedding_client,
)
from app.adapters.vector_store import vector_store as default_vector_store
from app.core.config import settings
from app.core.exceptions import IngestionError, ResourceNotFoundError
from app.db.models import DocumentSource, NormalizedDocumentRecord
from app.db.session import get_session_factory
from app.domain.schemas import (
    DocumentProviderType,
    DocumentReference,
    DocumentSyncRunSummary,
    FullSyncResult,
    IngestionResult,
    NormalizedDocument,
    SyncStatus,
    SyncStatusResponse,
    SyncTriggerType,
)
from app.repositories.document_repository import document_repository
from app.repositories.document_sync_run_repository import document_sync_run_repository
from app.services.bookstack_sync_config_service import (
    BookStackSelectionFilter,
    BookStackSyncConfigService,
    bookstack_sync_config_service as default_bookstack_sync_config_service,
)
from app.services.text_processor import (
    TextProcessor,
    text_processor as default_text_processor,
)
from app.services.audit_service import audit_service
from app.domain.audit_log import AuditEventCode


@dataclass
class _SyncCounters:
    seen: int = 0
    upserted: int = 0
    chunks_indexed: int = 0
    skipped: int = 0
    deleted: int = 0
    failed: int = 0


class DocumentSyncService:
    """Coordinates provider fetches, persistence, indexing, and sync audit state."""

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        embedding_client: EmbeddingClient = default_embedding_client,
        vector_store=default_vector_store,
        text_processor: TextProcessor = default_text_processor,
        bookstack_sync_config_service: BookStackSyncConfigService = default_bookstack_sync_config_service,
        provider_factory: Callable[[DocumentSource], DocumentProvider] | None = None,
    ) -> None:
        self.session_factory = session_factory or get_session_factory()
        self.embedding_client = embedding_client
        self.vector_store = vector_store
        self.text_processor = text_processor
        self.bookstack_sync_config_service = bookstack_sync_config_service
        self.provider_factory = provider_factory or self._default_provider_factory
        self.status: SyncStatus = SyncStatus.IDLE
        self.last_sync_at: datetime | None = None

    async def full_sync(
        self,
        *,
        source_key: str | None = None,
        trigger: SyncTriggerType | str = SyncTriggerType.MANUAL,
    ) -> FullSyncResult:
        started_at = datetime.now(timezone.utc)
        self.status = SyncStatus.SYNCING
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY

        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)
            provider = self.provider_factory(source)
            run = await document_sync_run_repository.create_run(
                session,
                source_id=source.id,
                trigger_type=self._normalize_trigger(trigger).value,
                status=SyncStatus.SYNCING.value,
            )
            await audit_service.logger().event(AuditEventCode.SYNC_TRIGGERED).desc(f"BookStack sync ({trigger}) started.").context(trigger=trigger).commit(session)
            await session.commit()

            counters = _SyncCounters()
            try:
                selection_filter = await self.bookstack_sync_config_service.get_selection_filter(
                    session,
                    source=source,
                )
                references = await provider.list_documents()
                references = self._filter_references(
                    references=references,
                    selection_filter=selection_filter,
                )
                counters.seen = len(references)

                existing_documents = await document_repository.list_active_documents_for_source(
                    session,
                    source.id,
                )
                existing_by_external_id = {
                    record.external_document_id: record for record in existing_documents
                }
                seen_external_ids = set()

                for reference in references:
                    seen_external_ids.add(reference.external_document_id)
                    outcome = await self._sync_reference(
                        session=session,
                        source=source,
                        provider=provider,
                        reference=reference,
                        selection_filter=selection_filter,
                    )
                    counters.upserted += int(outcome["status"] == "upserted")
                    counters.chunks_indexed += outcome.get("chunks_created", 0)
                    counters.skipped += int(outcome["status"] == "skipped")
                    counters.failed += int(outcome["status"] == "failed")

                missing_ids = set(existing_by_external_id) - seen_external_ids
                for external_document_id in missing_ids:
                    record = existing_by_external_id[external_document_id]
                    await self._delete_record(
                        session=session,
                        record=record,
                    )
                    counters.deleted += 1

                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.COMPLETED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=counters.seen,
                    documents_upserted=counters.upserted,
                    documents_skipped=counters.skipped,
                    documents_deleted=counters.deleted,
                    documents_failed=counters.failed,
                )
                await audit_service.logger().event(AuditEventCode.SYNC_COMPLETED).desc(f"BookStack sync finished: {counters.seen} seen, {counters.upserted} upserted, {counters.deleted} deleted.").context(seen=counters.seen, upserted=counters.upserted, deleted=counters.deleted, failed=counters.failed).commit(session)
                await session.commit()
                self.status = SyncStatus.COMPLETED
                self.last_sync_at = datetime.now(timezone.utc)

                return FullSyncResult(
                    total_pages=counters.seen,
                    pages_processed=counters.seen - counters.failed,
                    total_chunks=counters.chunks_indexed,
                    failed_pages=[],
                    duration_seconds=round(
                        (datetime.now(timezone.utc) - started_at).total_seconds(), 2
                    ),
                    status=SyncStatus.COMPLETED,
                )
            except Exception as exc:
                await session.rollback()
                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.FAILED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=counters.seen,
                    documents_upserted=counters.upserted,
                    documents_skipped=counters.skipped,
                    documents_deleted=counters.deleted,
                    documents_failed=counters.failed,
                    error_detail=str(exc),
                )
                await audit_service.logger().event(AuditEventCode.SYNC_FAILED).desc(f"BookStack sync failed: {str(exc)}").context(error=str(exc)).failed().commit(session)
                await session.commit()
                raise IngestionError(detail=f"Full sync failed: {exc}") from exc

    async def delta_sync(
        self,
        *,
        source_key: str | None = None,
        trigger: SyncTriggerType | str = SyncTriggerType.SCHEDULED,
    ) -> int:
        self.status = SyncStatus.SYNCING
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY

        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)
            provider = self.provider_factory(source)
            latest_run = await document_sync_run_repository.get_latest_completed_run_for_source(
                session,
                source.id,
            )
            if latest_run is None or latest_run.completed_at is None:
                result = await self.full_sync(source_key=source_key, trigger=trigger)
                return result.pages_processed

            since = latest_run.completed_at - timedelta(minutes=2)
            run = await document_sync_run_repository.create_run(
                session,
                source_id=source.id,
                trigger_type=self._normalize_trigger(trigger).value,
                status=SyncStatus.SYNCING.value,
            )
            await session.commit()

            counters = _SyncCounters()
            try:
                selection_filter = await self.bookstack_sync_config_service.get_selection_filter(
                    session,
                    source=source,
                )
                references = await provider.list_documents_updated_since(since)
                references = self._filter_references(
                    references=references,
                    selection_filter=selection_filter,
                )
                counters.seen = len(references)
                for reference in references:
                    outcome = await self._sync_reference(
                        session=session,
                        source=source,
                        provider=provider,
                        reference=reference,
                        selection_filter=selection_filter,
                    )
                    counters.upserted += int(outcome["status"] == "upserted")
                    counters.chunks_indexed += outcome.get("chunks_created", 0)
                    counters.skipped += int(outcome["status"] == "skipped")
                    counters.failed += int(outcome["status"] == "failed")

                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.COMPLETED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=counters.seen,
                    documents_upserted=counters.upserted,
                    documents_skipped=counters.skipped,
                    documents_deleted=0,
                    documents_failed=counters.failed,
                )
                await session.commit()
                self.status = SyncStatus.COMPLETED
                self.last_sync_at = datetime.now(timezone.utc)
                return counters.seen - counters.failed
            except Exception as exc:
                await session.rollback()
                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.FAILED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=counters.seen,
                    documents_upserted=counters.upserted,
                    documents_skipped=counters.skipped,
                    documents_deleted=0,
                    documents_failed=counters.failed,
                    error_detail=str(exc),
                )
                await session.commit()
                self.status = SyncStatus.FAILED
                raise IngestionError(detail=f"Delta sync failed: {exc}") from exc

    async def sync_document(
        self,
        *,
        source_key: str | None = None,
        external_document_id: str,
        trigger: SyncTriggerType | str = SyncTriggerType.MANUAL,
    ) -> IngestionResult:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        self.status = SyncStatus.SYNCING

        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)
            provider = self.provider_factory(source)
            reference = DocumentReference(
                source_key=source.source_key,
                provider_type=DocumentProviderType(source.provider_type),
                external_document_id=external_document_id,
            )
            run = await document_sync_run_repository.create_run(
                session,
                source_id=source.id,
                trigger_type=self._normalize_trigger(trigger).value,
                status=SyncStatus.SYNCING.value,
            )
            await session.commit()

            try:
                selection_filter = await self.bookstack_sync_config_service.get_selection_filter(
                    session,
                    source=source,
                )
                outcome = await self._sync_reference(
                    session=session,
                    source=source,
                    provider=provider,
                    reference=reference,
                    selection_filter=selection_filter,
                )
                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.COMPLETED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=1,
                    documents_upserted=int(outcome["status"] == "upserted"),
                    documents_skipped=int(outcome["status"] == "skipped"),
                    documents_deleted=0,
                    documents_failed=int(outcome["status"] == "failed"),
                )
                await session.commit()
                self.status = SyncStatus.COMPLETED
                self.last_sync_at = datetime.now(timezone.utc)

                page_id = self._numeric_document_id(source.source_key, external_document_id)
                return IngestionResult(
                    page_id=page_id,
                    page_title=outcome.get("title") or reference.title or external_document_id,
                    chunks_created=outcome.get("chunks_created", 0),
                    status=outcome["status"],
                )
            except Exception as exc:
                await session.rollback()
                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.FAILED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=1,
                    documents_upserted=0,
                    documents_skipped=0,
                    documents_deleted=0,
                    documents_failed=1,
                    error_detail=str(exc),
                )
                await session.commit()
                self.status = SyncStatus.FAILED
                raise IngestionError(detail=f"Failed to sync document {external_document_id}: {exc}") from exc

    async def delete_document(
        self,
        *,
        source_key: str | None = None,
        external_document_id: str,
        trigger: SyncTriggerType | str = SyncTriggerType.WEBHOOK,
    ) -> None:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)
            record = await document_repository.get_document_by_external_id(
                session,
                source_id=source.id,
                external_document_id=external_document_id,
            )
            if record is None:
                await self.vector_store.delete_by_document_uid(
                    self._document_uid(source.source_key, external_document_id)
                )
                return

            run = await document_sync_run_repository.create_run(
                session,
                source_id=source.id,
                trigger_type=self._normalize_trigger(trigger).value,
                status=SyncStatus.SYNCING.value,
            )
            await session.commit()

            try:
                await self._delete_record(session=session, record=record)
                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.COMPLETED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=1,
                    documents_upserted=0,
                    documents_skipped=0,
                    documents_deleted=1,
                    documents_failed=0,
                )
                await session.commit()
                self.status = SyncStatus.COMPLETED
                self.last_sync_at = datetime.now(timezone.utc)
            except Exception as exc:
                await session.rollback()
                await document_sync_run_repository.finalize_run(
                    session,
                    run,
                    status=SyncStatus.FAILED.value,
                    completed_at=datetime.now(timezone.utc),
                    documents_seen=1,
                    documents_upserted=0,
                    documents_skipped=0,
                    documents_deleted=0,
                    documents_failed=1,
                    error_detail=str(exc),
                )
                await session.commit()
                self.status = SyncStatus.FAILED
                raise IngestionError(detail=f"Failed to delete document {external_document_id}: {exc}") from exc

    async def get_status(self, *, source_key: str | None = None) -> SyncStatusResponse:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        async with self.session_factory() as session:
            source = await document_repository.get_source_by_key(session, source_key)
            
            # 1. Total Chunks from Pinecone
            try:
                stats = await self.vector_store.get_index_stats()
                total_chunks = stats.get("namespace_vectors", 0)
            except Exception:
                total_chunks = 0

            if source is None:
                return SyncStatusResponse(
                    is_syncing=self.status == SyncStatus.SYNCING,
                    total_pages_synced=0,
                    total_chunks_synced=total_chunks,
                    last_sync_at=self.last_sync_at,
                    source_key=source_key,
                )

            # 2. Latest Run for Status & Timing
            latest_run = await document_sync_run_repository.get_latest_run_for_source(
                session,
                source.id,
            )
            
            # 3. Active Pages from Postgres
            pages_synced = await document_repository.count_active_documents_for_source(
                session,
                source.id,
            )

            is_syncing = self.status == SyncStatus.SYNCING
            last_sync_at = self.last_sync_at
            last_duration = 0.0
            error_msg = None

            if latest_run is not None:
                is_syncing = latest_run.status == SyncStatus.SYNCING.value
                last_sync_at = latest_run.completed_at or latest_run.started_at
                if latest_run.completed_at:
                    last_duration = (latest_run.completed_at - latest_run.started_at).total_seconds()
                if latest_run.status == SyncStatus.FAILED.value:
                    error_msg = latest_run.error_detail

            return SyncStatusResponse(
                is_syncing=is_syncing,
                total_pages_synced=pages_synced,
                total_chunks_synced=total_chunks,
                last_sync_at=last_sync_at,
                last_sync_duration=last_duration,
                error=error_msg,
                source_key=source.source_key,
            )

    async def get_source_health(self, *, source_key: str | None = None) -> dict[str, Any]:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)
            provider = self.provider_factory(source)
            latest_run = await document_sync_run_repository.get_latest_run_for_source(
                session,
                source.id,
            )
            return {
                "source_key": source.source_key,
                "provider_type": source.provider_type,
                "healthy": await provider.health_check(),
                "last_sync_status": latest_run.status if latest_run else SyncStatus.IDLE.value,
                "last_sync_at": latest_run.completed_at if latest_run else None,
            }

    async def _ensure_source(
        self,
        session: AsyncSession,
        *,
        source_key: str,
    ) -> DocumentSource:
        source = await document_repository.get_source_by_key(session, source_key)
        if source is not None:
            return source

        if source_key != settings.BOOKSTACK_SOURCE_KEY:
            raise ResourceNotFoundError(detail=f"Document source '{source_key}' is not registered.")

        source = await document_repository.create_source(
            session,
            source_key=source_key,
            provider_type=DocumentProviderType.BOOKSTACK.value,
            display_name=settings.BOOKSTACK_SOURCE_NAME,
            config={},
            sync_enabled=True,
        )
        await session.commit()
        return source

    async def _sync_reference(
        self,
        *,
        session: AsyncSession,
        source: DocumentSource,
        provider: DocumentProvider,
        reference: DocumentReference,
        selection_filter: BookStackSelectionFilter | None = None,
    ) -> dict[str, Any]:
        source_key = source.source_key
        selection_filter = selection_filter or BookStackSelectionFilter(mode="all")
        try:
            document = await provider.get_document(
                reference.external_document_id,
                reference=reference,
            )
            if not self._should_sync_document(
                document=document,
                selection_filter=selection_filter,
            ):
                existing = await document_repository.get_document_by_external_id(
                    session,
                    source_id=source.id,
                    external_document_id=document.external_document_id,
                )
                if existing is not None:
                    await self._delete_record(session=session, record=existing)
                return {
                    "status": "skipped",
                    "title": document.title,
                    "chunks_created": 0,
                }
            existing = await document_repository.get_document_by_external_id(
                session,
                source_id=source.id,
                external_document_id=document.external_document_id,
            )

            if self._is_unchanged(existing, document):
                existing.is_deleted = False
                existing.last_synced_at = datetime.now(timezone.utc)
                existing.last_error = None
                session.add(existing)
                await session.commit()
                return {
                    "status": "skipped",
                    "title": existing.title,
                    "chunks_created": 0,
                }

            chunks = self.text_processor.process_document(document)
            await self.vector_store.delete_by_document_uid(document.document_uid)
            vectors = await self.embedding_client.embed_texts([chunk.text for chunk in chunks])
            await self.vector_store.upsert_vectors(
                ids=[chunk.chunk_id for chunk in chunks],
                vectors=vectors,
                metadatas=[chunk.metadata for chunk in chunks],
            )

            record = existing or NormalizedDocumentRecord(
                source_id=source.id,
                document_uid=document.document_uid,
                external_document_id=document.external_document_id,
            )
            self._apply_document_to_record(record, document)
            record.last_synced_at = datetime.now(timezone.utc)
            record.last_indexed_at = datetime.now(timezone.utc)
            record.is_deleted = False
            record.last_error = None
            session.add(record)
            await session.commit()
            return {
                "status": "upserted",
                "title": document.title,
                "chunks_created": len(chunks),
            }
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "document.sync_failed",
                source_key=source_key,
                external_document_id=reference.external_document_id,
                error=str(exc),
            )
            return {
                "status": "failed",
                "title": reference.title,
                "chunks_created": 0,
                "error": str(exc),
            }

    def _filter_references(
        self,
        *,
        references: list[DocumentReference],
        selection_filter: BookStackSelectionFilter,
    ) -> list[DocumentReference]:
        if selection_filter.mode != "custom":
            return references
        return [reference for reference in references if selection_filter.matches_reference(reference)]

    def _should_sync_document(
        self,
        *,
        document: NormalizedDocument,
        selection_filter: BookStackSelectionFilter,
    ) -> bool:
        if selection_filter.mode != "custom":
            return True

        reference = DocumentReference(
            source_key=document.source_key,
            provider_type=document.provider_type,
            external_document_id=document.external_document_id,
            external_parent_id=document.external_parent_id,
            title=document.title,
            source_url=document.source_url,
            container_name=document.container_name,
            provider_updated_at=document.provider_updated_at,
            metadata=document.metadata,
        )
        return selection_filter.matches_reference(reference)

    async def _delete_record(
        self,
        *,
        session: AsyncSession,
        record: NormalizedDocumentRecord,
    ) -> None:
        await self.vector_store.delete_by_document_uid(record.document_uid)
        record.is_deleted = True
        record.last_synced_at = datetime.now(timezone.utc)
        record.last_indexed_at = None
        record.last_error = None
        session.add(record)
        await audit_service.logger().event(AuditEventCode.DOC_DELETED).resource("document_record", record.id).desc(f"Document record '{record.title}' marked as deleted.").context(title=record.title, external_id=record.external_document_id).commit(session)
        await session.commit()

    def _apply_document_to_record(
        self,
        record: NormalizedDocumentRecord,
        document: NormalizedDocument,
    ) -> None:
        record.document_uid = document.document_uid
        record.external_document_id = document.external_document_id
        record.external_parent_id = document.external_parent_id
        record.title = document.title
        record.source_url = document.source_url
        record.container_name = document.container_name
        record.content_format = document.content_format.value
        record.checksum = document.checksum
        record.provider_updated_at = document.provider_updated_at
        record.metadata_json = document.metadata
        record.access_scope_json = document.access_scope

    def _is_unchanged(
        self,
        existing: NormalizedDocumentRecord | None,
        document: NormalizedDocument,
    ) -> bool:
        if existing is None:
            return False
        if existing.is_deleted:
            return False
        if existing.checksum != document.checksum:
            return False
        if existing.provider_updated_at != document.provider_updated_at:
            return False
        return True

    def _default_provider_factory(self, source: DocumentSource) -> DocumentProvider:
        if source.provider_type == DocumentProviderType.BOOKSTACK.value:
            return BookStackProvider(source_key=source.source_key)
        raise ResourceNotFoundError(
            detail=f"No document provider is registered for '{source.provider_type}'."
        )

    @staticmethod
    def _document_uid(source_key: str, external_document_id: str) -> str:
        return f"{source_key}:{external_document_id}"

    @staticmethod
    def _numeric_document_id(source_key: str, external_document_id: str) -> int:
        try:
            return int(external_document_id)
        except ValueError:
            checksum = crc32(f"{source_key}:{external_document_id}".encode("utf-8"))
            return checksum & 0x7FFFFFFF

    @staticmethod
    def _normalize_trigger(trigger: SyncTriggerType | str) -> SyncTriggerType:
        if isinstance(trigger, SyncTriggerType):
            return trigger
        return SyncTriggerType(trigger)


document_sync_service = DocumentSyncService()
