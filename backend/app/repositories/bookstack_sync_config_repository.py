from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BookStackSyncConfig


class BookStackSyncConfigRepository:
    async def list_for_source(
        self,
        session: AsyncSession,
        *,
        source_id: UUID,
        user_id: UUID | None = None,
    ) -> list[BookStackSyncConfig]:
        stmt = (
            select(BookStackSyncConfig)
            .where(
                BookStackSyncConfig.source_id == source_id,
                BookStackSyncConfig.user_id == user_id,
            )
            .order_by(
                BookStackSyncConfig.book_id.asc().nulls_last(),
                BookStackSyncConfig.chapter_id.asc().nulls_last(),
                BookStackSyncConfig.page_id.asc().nulls_last(),
            )
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def replace_for_source(
        self,
        session: AsyncSession,
        *,
        source_id: UUID,
        entries: list[BookStackSyncConfig],
        user_id: UUID | None = None,
    ) -> list[BookStackSyncConfig]:
        await session.execute(
            delete(BookStackSyncConfig).where(
                BookStackSyncConfig.source_id == source_id,
                BookStackSyncConfig.user_id == user_id,
            )
        )
        for entry in entries:
            session.add(entry)
        await session.flush()
        return entries


bookstack_sync_config_repository = BookStackSyncConfigRepository()
