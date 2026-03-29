from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import ChatMessageRecord, ChatSession


class ChatRepository:
    async def create_chat(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        title: str | None = None,
    ) -> ChatSession:
        chat = ChatSession(user_id=user_id, title=title)
        session.add(chat)
        await session.flush()
        await session.refresh(chat)
        return chat

    async def get_chat_for_user(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
        user_id: UUID,
    ) -> ChatSession | None:
        stmt = (
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(
                ChatSession.id == chat_id, 
                ChatSession.user_id == user_id,
                ChatSession.deleted_at.is_(None)
            )
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def get_chat_by_id(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
    ) -> ChatSession | None:
        stmt = (
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.id == chat_id, ChatSession.deleted_at.is_(None))
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def list_chats_for_user(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        limit: int,
    ) -> tuple[list[tuple[ChatSession, int, str | None]], bool]:
        message_count = (
            select(func.count(ChatMessageRecord.id))
            .where(ChatMessageRecord.chat_id == ChatSession.id)
            .scalar_subquery()
        )
        last_preview = (
            select(ChatMessageRecord.content)
            .where(ChatMessageRecord.chat_id == ChatSession.id)
            .order_by(ChatMessageRecord.created_at.desc())
            .limit(1)
            .scalar_subquery()
        )

        stmt: Select = (
            select(
                ChatSession,
                message_count.label("message_count"),
                last_preview.label("last_message_preview"),
            )
            .where(ChatSession.user_id == user_id, ChatSession.deleted_at.is_(None))
            .order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc())
            .limit(limit + 1)
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        normalized = [(row[0], int(row[1] or 0), row[2]) for row in rows]
        return normalized, has_more

    async def list_messages_for_chat(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
    ) -> list[ChatMessageRecord]:
        stmt = (
            select(ChatMessageRecord)
            .where(ChatMessageRecord.chat_id == chat_id)
            .order_by(ChatMessageRecord.created_at.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def list_messages_page_for_chat(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
        limit: int,
        before: datetime | None = None,
    ) -> tuple[list[ChatMessageRecord], bool]:
        normalized_limit = max(1, min(limit, 100))
        stmt = select(ChatMessageRecord).where(ChatMessageRecord.chat_id == chat_id)
        if before is not None:
            stmt = stmt.where(ChatMessageRecord.created_at < before)
        stmt = (
            stmt.order_by(ChatMessageRecord.created_at.desc(), ChatMessageRecord.id.desc())
            .limit(normalized_limit + 1)
        )
        result = await session.execute(stmt)
        messages = list(result.scalars().all())
        has_more = len(messages) > normalized_limit
        if has_more:
            messages = messages[:normalized_limit]
        messages.reverse()
        return messages, has_more

    async def count_messages_for_chat(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
    ) -> int:
        stmt = select(func.count(ChatMessageRecord.id)).where(ChatMessageRecord.chat_id == chat_id)
        result = await session.execute(stmt)
        return int(result.scalar_one())

    async def list_recent_messages_for_chat(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
        limit: int,
    ) -> list[ChatMessageRecord]:
        stmt = (
            select(ChatMessageRecord)
            .where(ChatMessageRecord.chat_id == chat_id)
            .order_by(ChatMessageRecord.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        messages = list(result.scalars().all())
        messages.reverse()
        return messages

    async def create_message(
        self,
        session: AsyncSession,
        *,
        chat_id: UUID,
        sender: str,
        content: str,
        metadata: dict | None = None,
    ) -> ChatMessageRecord:
        message = ChatMessageRecord(
            chat_id=chat_id,
            sender=sender,
            content=content,
            metadata_json=metadata,
        )
        session.add(message)
        await session.flush()
        await session.refresh(message)
        return message

    async def update_chat_title(
        self,
        session: AsyncSession,
        *,
        chat: ChatSession,
        title: str | None,
    ) -> ChatSession:
        chat.title = title
        session.add(chat)
        await session.flush()
        return chat

    async def touch_chat(
        self,
        session: AsyncSession,
        *,
        chat: ChatSession,
        when: datetime,
    ) -> ChatSession:
        chat.updated_at = when
        session.add(chat)
        await session.flush()
        return chat

    async def soft_delete_chat(
        self,
        session: AsyncSession,
        *,
        chat: ChatSession,
    ) -> None:
        chat.deleted_at = datetime.now(timezone.utc)
        session.add(chat)
        await session.flush()


chat_repository = ChatRepository()
