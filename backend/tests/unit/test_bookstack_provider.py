from app.adapters.document_providers.bookstack_provider import BookStackProvider
from app.domain.schemas import BookStackBook, BookStackPage, DocumentProviderType
import pytest


class FakeBookStackClient:
    async def get_all_pages(self):
        return [
            BookStackPage(
                id=42,
                name="SSO Setup",
                slug="sso-setup",
                html="<h1>SSO Setup</h1><p>Configure SSO.</p>",
                book_id=7,
                chapter_id=3,
                updated_at="2026-03-27T10:00:00Z",
            )
        ]

    async def get_pages_updated_after(self, _timestamp: str):
        return await self.get_all_pages()

    async def get_page(self, page_id: int):
        pages = await self.get_all_pages()
        return pages[0]

    async def list_books(self):
        return [
            BookStackBook(id=7, name="Admin Docs", slug="admin-docs")
        ]

    async def list_pages(self, count: int = 1):
        return (await self.get_all_pages())[:count]


async def _get_provider():
    return BookStackProvider(
        source_key="bookstack_default",
        client=FakeBookStackClient(),
    )
@pytest.mark.asyncio
async def test_bookstack_provider_lists_normalized_references():
    provider = await _get_provider()

    references = await provider.list_documents()

    assert len(references) == 1
    reference = references[0]
    assert reference.provider_type == DocumentProviderType.BOOKSTACK
    assert reference.external_document_id == "42"
    assert reference.container_name == "Admin Docs"
    assert reference.source_url.endswith("/books/admin-docs/page/sso-setup")
    assert reference.metadata["chapter_id"] == 3


@pytest.mark.asyncio
async def test_bookstack_provider_fetches_normalized_document():
    provider = await _get_provider()

    document = await provider.get_document("42")

    assert document.provider_type == DocumentProviderType.BOOKSTACK
    assert document.external_document_id == "42"
    assert document.document_uid == "bookstack_default:42"
    assert document.content_format.value == "html"
    assert document.metadata["book_title"] == "Admin Docs"
    assert document.source_url.endswith("/books/admin-docs/page/sso-setup")
    assert document.checksum


class NoBooksBookStackClient(FakeBookStackClient):
    async def get_all_pages(self):
        return [
            BookStackPage(
                id=99,
                name="Top Level Page",
                slug="top-level-page",
                html="<h1>Top Level Page</h1>",
                book_id=1,
                chapter_id=None,
                updated_at="2026-03-27T10:00:00Z",
            )
        ]

    async def list_books(self):
        raise RuntimeError("books endpoint unavailable")


@pytest.mark.asyncio
async def test_bookstack_provider_handles_null_chapter_and_missing_books():
    provider = BookStackProvider(
        source_key="bookstack_default",
        client=NoBooksBookStackClient(),
    )

    references = await provider.list_documents()
    document = await provider.get_document("99")

    assert len(references) == 1
    assert references[0].metadata["chapter_id"] is None
    assert references[0].container_name == ""
    assert document.external_parent_id is None
    assert document.metadata["book_title"] == ""
