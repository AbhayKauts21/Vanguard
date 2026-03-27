"""Compatibility layer over the provider-based document sync service."""

from __future__ import annotations

from app.core.config import settings
from app.domain.schemas import FullSyncResult, IngestionResult, SyncStatusResponse
from app.services.document_sync_service import (
    document_sync_service as default_document_sync_service,
)


class IngestionService:
    """Legacy BookStack-facing API preserved on top of the generic sync service."""

    def __init__(self, *, document_sync_service=default_document_sync_service) -> None:
        self.document_sync_service = document_sync_service

    async def ingest_single_page(self, page_id: int) -> IngestionResult:
        return await self.document_sync_service.sync_document(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
            external_document_id=str(page_id),
        )

    async def full_sync(self) -> FullSyncResult:
        return await self.document_sync_service.full_sync(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
        )

    async def delta_sync(self) -> int:
        return await self.document_sync_service.delta_sync(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
        )

    async def delete_page(self, page_id: int) -> None:
        await self.document_sync_service.delete_document(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
            external_document_id=str(page_id),
        )

    async def get_status(self) -> SyncStatusResponse:
        return await self.document_sync_service.get_status(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
        )


ingestion_service = IngestionService()
