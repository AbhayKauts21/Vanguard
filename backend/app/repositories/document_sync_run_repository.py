from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DocumentSyncRun


class DocumentSyncRunRepository:
    async def create_run(
        self,
        session: AsyncSession,
        *,
        source_id,
        trigger_type: str,
        status: str,
    ) -> DocumentSyncRun:
        run = DocumentSyncRun(
            source_id=source_id,
            trigger_type=trigger_type,
            status=status,
        )
        session.add(run)
        await session.flush()
        await session.refresh(run)
        return run

    async def finalize_run(
        self,
        session: AsyncSession,
        run: DocumentSyncRun,
        *,
        status: str,
        completed_at: datetime,
        documents_seen: int,
        documents_upserted: int,
        documents_skipped: int,
        documents_deleted: int,
        documents_failed: int,
        error_detail: str | None = None,
    ) -> DocumentSyncRun:
        run.status = status
        run.completed_at = completed_at
        run.documents_seen = documents_seen
        run.documents_upserted = documents_upserted
        run.documents_skipped = documents_skipped
        run.documents_deleted = documents_deleted
        run.documents_failed = documents_failed
        run.error_detail = error_detail
        session.add(run)
        await session.flush()
        return run

    async def get_latest_run_for_source(
        self,
        session: AsyncSession,
        source_id,
    ) -> DocumentSyncRun | None:
        stmt = (
            select(DocumentSyncRun)
            .where(DocumentSyncRun.source_id == source_id)
            .order_by(desc(DocumentSyncRun.started_at))
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def get_latest_completed_run_for_source(
        self,
        session: AsyncSession,
        source_id,
    ) -> DocumentSyncRun | None:
        stmt = (
            select(DocumentSyncRun)
            .where(
                DocumentSyncRun.source_id == source_id,
                DocumentSyncRun.status == "completed",
                DocumentSyncRun.completed_at.is_not(None),
            )
            .order_by(desc(DocumentSyncRun.completed_at))
        )
        result = await session.execute(stmt)
        return result.scalars().first()


document_sync_run_repository = DocumentSyncRunRepository()
