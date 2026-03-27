from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import DocumentSource, NormalizedDocumentRecord


class DocumentRepository:
    async def get_source_by_key(
        self,
        session: AsyncSession,
        source_key: str,
    ) -> DocumentSource | None:
        stmt = (
            select(DocumentSource)
            .options(selectinload(DocumentSource.documents))
            .where(DocumentSource.source_key == source_key)
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def create_source(
        self,
        session: AsyncSession,
        *,
        source_key: str,
        provider_type: str,
        display_name: str,
        config: dict | None = None,
        sync_enabled: bool = True,
    ) -> DocumentSource:
        source = DocumentSource(
            source_key=source_key,
            provider_type=provider_type,
            display_name=display_name,
            config=config,
            sync_enabled=sync_enabled,
        )
        session.add(source)
        await session.flush()
        await session.refresh(source)
        return source

    async def list_active_documents_for_source(
        self,
        session: AsyncSession,
        source_id,
    ) -> list[NormalizedDocumentRecord]:
        stmt = (
            select(NormalizedDocumentRecord)
            .where(
                NormalizedDocumentRecord.source_id == source_id,
                NormalizedDocumentRecord.is_deleted.is_(False),
            )
            .order_by(NormalizedDocumentRecord.title.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_document_by_external_id(
        self,
        session: AsyncSession,
        *,
        source_id,
        external_document_id: str,
    ) -> NormalizedDocumentRecord | None:
        stmt = select(NormalizedDocumentRecord).where(
            NormalizedDocumentRecord.source_id == source_id,
            NormalizedDocumentRecord.external_document_id == external_document_id,
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def count_active_documents_for_source(
        self,
        session: AsyncSession,
        source_id,
    ) -> int:
        stmt = select(func.count()).select_from(NormalizedDocumentRecord).where(
            NormalizedDocumentRecord.source_id == source_id,
            NormalizedDocumentRecord.is_deleted.is_(False),
        )
        result = await session.execute(stmt)
        return int(result.scalar_one())


document_repository = DocumentRepository()
