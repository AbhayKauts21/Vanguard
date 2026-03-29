from __future__ import annotations

from contextlib import asynccontextmanager
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.domain.schemas import BookStackBook, BookStackChapter, BookStackPage, DocumentProviderType, DocumentReference
from app.services.bookstack_sync_config_service import (
    SELECTIVE_SYNC_FLAG,
    BookStackSelectionFilter,
    BookStackSyncConfigService,
)


class FakeSession:
    async def commit(self) -> None:
        return None


def build_session_factory(session: FakeSession):
    @asynccontextmanager
    async def factory():
        yield session

    return factory


class FakeBookStackClient:
    async def list_books(self):
        return [
            BookStackBook(id=1, name="Platform", slug="platform"),
        ]

    async def get_all_chapters(self):
        return [
            BookStackChapter(id=10, name="Getting Started", slug="getting-started", book_id=1),
        ]

    async def get_all_pages(self):
        return [
            BookStackPage(id=100, name="Overview", slug="overview", book_id=1, chapter_id=None),
            BookStackPage(id=101, name="Install", slug="install", book_id=1, chapter_id=10),
        ]


@pytest.mark.asyncio
async def test_get_tree_returns_books_chapters_and_direct_pages(monkeypatch):
    service = BookStackSyncConfigService(
        session_factory=build_session_factory(FakeSession()),
        client=FakeBookStackClient(),
    )

    async def fake_ensure_source(_session, *, source_key: str):
        return SimpleNamespace(source_key=source_key)

    monkeypatch.setattr(service, "_ensure_source", fake_ensure_source)

    response = await service.get_tree(source_key="bookstack_default")

    assert len(response.items) == 1
    book = response.items[0]
    assert book.book_id == 1
    assert book.pages[0].page_id == 100
    assert book.chapters[0].chapter_id == 10
    assert book.chapters[0].pages[0].page_id == 101


@pytest.mark.asyncio
async def test_selection_filter_matches_book_chapter_and_page(monkeypatch):
    service = BookStackSyncConfigService(
        session_factory=build_session_factory(FakeSession()),
        client=FakeBookStackClient(),
    )
    source = SimpleNamespace(id=uuid4(), config={SELECTIVE_SYNC_FLAG: True})

    async def fake_list_for_source(*_args, **_kwargs):
        return [
            SimpleNamespace(book_id=1, chapter_id=None, page_id=None, is_enabled=True),
            SimpleNamespace(book_id=None, chapter_id=10, page_id=None, is_enabled=True),
            SimpleNamespace(book_id=None, chapter_id=None, page_id=999, is_enabled=True),
        ]

    monkeypatch.setattr(
        "app.services.bookstack_sync_config_service.bookstack_sync_config_repository.list_for_source",
        fake_list_for_source,
    )

    selection_filter = await service.get_selection_filter(FakeSession(), source=source)

    assert selection_filter.mode == "custom"
    assert selection_filter.matches_reference(
        DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="100",
            metadata={"book_id": 1, "chapter_id": None, "page_id": 100},
        )
    )
    assert selection_filter.matches_reference(
        DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="101",
            metadata={"book_id": 2, "chapter_id": 10, "page_id": 101},
        )
    )
    assert selection_filter.matches_reference(
        DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="999",
            metadata={"book_id": 2, "chapter_id": None, "page_id": 999},
        )
    )
    assert not selection_filter.matches_reference(
        DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="777",
            metadata={"book_id": 3, "chapter_id": 30, "page_id": 777},
        )
    )


def test_selection_filter_defaults_to_all_mode():
    selection_filter = BookStackSelectionFilter()

    assert selection_filter.mode == "all"
    assert selection_filter.matches_reference(
        DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="42",
        )
    )
