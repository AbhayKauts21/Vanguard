"""Provider implementation for BookStack-backed documentation."""

from __future__ import annotations

from datetime import datetime
import hashlib
from loguru import logger

from app.adapters.bookstack_client import (
    BookStackClient,
    bookstack_client as default_bookstack_client,
)
from app.domain.schemas import (
    BookStackPage,
    DocumentProviderType,
    DocumentContentFormat,
    DocumentReference,
    NormalizedDocument,
)
from app.adapters.document_providers.base import DocumentProvider
from app.core.config import settings


class BookStackProvider(DocumentProvider):
    provider_type = DocumentProviderType.BOOKSTACK.value

    def __init__(
        self,
        *,
        source_key: str,
        client: BookStackClient = default_bookstack_client,
    ) -> None:
        self.source_key = source_key
        self.client = client

    async def health_check(self) -> bool:
        try:
            await self.client.list_pages(count=1)
            return True
        except Exception:
            return False

    async def list_documents(self) -> list[DocumentReference]:
        pages = await self.client.get_all_pages()
        book_map = await self._build_book_map()
        return [self._to_reference(page, book_map.get(page.book_id, "")) for page in pages]

    async def list_documents_updated_since(self, since: datetime) -> list[DocumentReference]:
        pages = await self.client.get_pages_updated_after(
            since.strftime("%Y-%m-%d %H:%M:%S")
        )
        book_map = await self._build_book_map()
        return [self._to_reference(page, book_map.get(page.book_id, "")) for page in pages]

    async def get_document(
        self,
        external_document_id: str,
        *,
        reference: DocumentReference | None = None,
    ) -> NormalizedDocument:
        page = await self.client.get_page(int(external_document_id))
        container_name = reference.container_name if reference else ""
        if not container_name:
            book_map = await self._build_book_map()
            container_name = book_map.get(page.book_id, "")

        source_url = reference.source_url if reference else self._build_page_url(page)
        checksum = self._build_checksum(page)

        return NormalizedDocument(
            source_key=self.source_key,
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id=str(page.id),
            external_parent_id=str(page.chapter_id) if page.chapter_id else None,
            title=page.name,
            content=page.html,
            content_format=DocumentContentFormat.HTML,
            source_url=source_url,
            container_name=container_name,
            provider_updated_at=self._parse_datetime(page.updated_at),
            checksum=checksum,
            metadata={
                "page_id": page.id,
                "book_id": page.book_id,
                "book_title": container_name,
                "chapter_id": page.chapter_id,
                "slug": page.slug,
            },
            access_scope=None,
        )

    async def _build_book_map(self) -> dict[int, str]:
        try:
            books = await self.client.list_books()
        except Exception as exc:
            logger.warning(
                "BookStack book enrichment unavailable for source '{}': {}",
                self.source_key,
                exc,
            )
            return {}
        return {book.id: book.name for book in books}

    def _to_reference(self, page: BookStackPage, book_title: str) -> DocumentReference:
        return DocumentReference(
            source_key=self.source_key,
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id=str(page.id),
            external_parent_id=str(page.chapter_id) if page.chapter_id else None,
            title=page.name,
            source_url=self._build_page_url(page),
            container_name=book_title,
            provider_updated_at=self._parse_datetime(page.updated_at),
            metadata={
                "page_id": page.id,
                "book_id": page.book_id,
                "book_title": book_title,
                "chapter_id": page.chapter_id,
                "slug": page.slug,
            },
        )

    def _build_page_url(self, page: BookStackPage) -> str:
        return f"{settings.BOOKSTACK_URL.rstrip('/')}{page.url_path}"

    def _build_checksum(self, page: BookStackPage) -> str:
        payload = "|".join(
            [
                str(page.id),
                page.name,
                page.slug,
                page.updated_at,
                page.html,
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _parse_datetime(self, value: str) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
