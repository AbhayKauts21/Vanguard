from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.bookstack_client import BookStackClient, bookstack_client as default_bookstack_client
from app.core.config import settings
from app.core.exceptions import ResourceNotFoundError
from app.db.models import BookStackSyncConfig, DocumentSource
from app.db.session import get_session_factory
from app.domain.schemas import (
    BookStackSyncConfigRequest,
    BookStackSyncConfigResponse,
    BookStackTreeBook,
    BookStackTreeChapter,
    BookStackTreePage,
    BookStackTreeResponse,
    DocumentProviderType,
    DocumentReference,
)
from app.repositories.bookstack_sync_config_repository import bookstack_sync_config_repository
from app.repositories.document_repository import document_repository


SELECTIVE_SYNC_FLAG = "bookstack_selective_sync_enabled"


@dataclass(slots=True)
class BookStackSelectionFilter:
    mode: str = "all"
    enabled_book_ids: set[int] = field(default_factory=set)
    enabled_chapter_ids: set[int] = field(default_factory=set)
    enabled_page_ids: set[int] = field(default_factory=set)

    def matches_reference(self, reference: DocumentReference) -> bool:
        if self.mode != "custom":
            return True

        page_id = _parse_int(reference.metadata.get("page_id")) or _parse_int(reference.external_document_id)
        chapter_id = _parse_int(reference.metadata.get("chapter_id"))
        book_id = _parse_int(reference.metadata.get("book_id"))

        if page_id is not None and page_id in self.enabled_page_ids:
            return True
        if chapter_id is not None and chapter_id in self.enabled_chapter_ids:
            return True
        if book_id is not None and book_id in self.enabled_book_ids:
            return True
        return False


def _parse_int(value: object) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _target_key(*, book_id: int | None = None, chapter_id: int | None = None, page_id: int | None = None) -> str:
    if page_id is not None:
        return f"page:{page_id}"
    if chapter_id is not None:
        return f"chapter:{chapter_id}"
    if book_id is not None:
        return f"book:{book_id}"
    raise ValueError("At least one target identifier is required.")


class BookStackSyncConfigService:
    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        client: BookStackClient = default_bookstack_client,
    ) -> None:
        self.session_factory = session_factory or get_session_factory()
        self.client = client

    async def get_tree(self, *, source_key: str | None = None) -> BookStackTreeResponse:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        async with self.session_factory() as session:
            await self._ensure_source(session, source_key=source_key)

        books = await self.client.list_books()
        chapters = await self.client.get_all_chapters()
        pages = await self.client.get_all_pages()

        pages_by_chapter: dict[int, list[BookStackTreePage]] = {}
        book_level_pages: dict[int, list[BookStackTreePage]] = {}

        for page in pages:
            node = BookStackTreePage(page_id=page.id, name=page.name)
            if page.chapter_id is not None:
                pages_by_chapter.setdefault(page.chapter_id, []).append(node)
            else:
                book_level_pages.setdefault(page.book_id, []).append(node)

        chapters_by_book: dict[int, list[BookStackTreeChapter]] = {}
        for chapter in chapters:
            chapter_node = BookStackTreeChapter(
                chapter_id=chapter.id,
                name=chapter.name,
                pages=sorted(
                    pages_by_chapter.get(chapter.id, []),
                    key=lambda item: item.name.lower(),
                ),
            )
            chapters_by_book.setdefault(chapter.book_id, []).append(chapter_node)

        book_names = {book.id: book.name for book in books}
        all_book_ids = sorted(
            set(book_names)
            | set(book_level_pages)
            | set(chapters_by_book),
            key=lambda book_id: book_names.get(book_id, f"Book {book_id}").lower(),
        )

        items = [
            BookStackTreeBook(
                book_id=book_id,
                name=book_names.get(book_id, f"Book {book_id}"),
                pages=sorted(book_level_pages.get(book_id, []), key=lambda item: item.name.lower()),
                chapters=sorted(
                    chapters_by_book.get(book_id, []),
                    key=lambda item: item.name.lower(),
                ),
            )
            for book_id in all_book_ids
        ]
        return BookStackTreeResponse(items=items)

    async def get_config(self, *, source_key: str | None = None) -> BookStackSyncConfigResponse:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)
            rows = await bookstack_sync_config_repository.list_for_source(session, source_id=source.id)
            return self._to_response(source=source, rows=rows)

    async def save_config(
        self,
        payload: BookStackSyncConfigRequest,
        *,
        source_key: str | None = None,
    ) -> BookStackSyncConfigResponse:
        source_key = source_key or settings.BOOKSTACK_SOURCE_KEY
        async with self.session_factory() as session:
            source = await self._ensure_source(session, source_key=source_key)

            rows = self._rows_from_payload(source_id=source.id, payload=payload)
            await bookstack_sync_config_repository.replace_for_source(
                session,
                source_id=source.id,
                entries=rows,
            )

            source_config = dict(source.config or {})
            source_config[SELECTIVE_SYNC_FLAG] = True
            source.config = source_config
            session.add(source)
            await session.commit()
            return self._to_response(source=source, rows=rows)

    async def get_selection_filter(
        self,
        session: AsyncSession,
        *,
        source: DocumentSource,
    ) -> BookStackSelectionFilter:
        source_config = source.config or {}
        if not source_config.get(SELECTIVE_SYNC_FLAG):
            return BookStackSelectionFilter(mode="all")

        rows = await bookstack_sync_config_repository.list_for_source(session, source_id=source.id)
        return BookStackSelectionFilter(
            mode="custom",
            enabled_book_ids={row.book_id for row in rows if row.is_enabled and row.book_id is not None},
            enabled_chapter_ids={row.chapter_id for row in rows if row.is_enabled and row.chapter_id is not None},
            enabled_page_ids={row.page_id for row in rows if row.is_enabled and row.page_id is not None},
        )

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

    def _rows_from_payload(
        self,
        *,
        source_id: UUID,
        payload: BookStackSyncConfigRequest,
    ) -> list[BookStackSyncConfig]:
        book_ids = sorted(set(payload.enabled_book_ids))
        chapter_ids = sorted(set(payload.enabled_chapter_ids))
        page_ids = sorted(set(payload.enabled_page_ids))

        rows: list[BookStackSyncConfig] = []
        for book_id in book_ids:
            rows.append(
                BookStackSyncConfig(
                    source_id=source_id,
                    target_key=_target_key(book_id=book_id),
                    book_id=book_id,
                    is_enabled=True,
                )
            )
        for chapter_id in chapter_ids:
            rows.append(
                BookStackSyncConfig(
                    source_id=source_id,
                    target_key=_target_key(chapter_id=chapter_id),
                    chapter_id=chapter_id,
                    is_enabled=True,
                )
            )
        for page_id in page_ids:
            rows.append(
                BookStackSyncConfig(
                    source_id=source_id,
                    target_key=_target_key(page_id=page_id),
                    page_id=page_id,
                    is_enabled=True,
                )
            )
        return rows

    def _to_response(
        self,
        *,
        source: DocumentSource,
        rows: list[BookStackSyncConfig],
    ) -> BookStackSyncConfigResponse:
        selection_mode = "custom" if (source.config or {}).get(SELECTIVE_SYNC_FLAG) else "all"
        return BookStackSyncConfigResponse(
            source_key=source.source_key,
            selection_mode=selection_mode,
            enabled_book_ids=sorted({row.book_id for row in rows if row.book_id is not None and row.is_enabled}),
            enabled_chapter_ids=sorted(
                {row.chapter_id for row in rows if row.chapter_id is not None and row.is_enabled}
            ),
            enabled_page_ids=sorted({row.page_id for row in rows if row.page_id is not None and row.is_enabled}),
        )


bookstack_sync_config_service = BookStackSyncConfigService()
