"""BookStack REST API client — fetches pages, books, chapters."""

from typing import List, Optional

import httpx
from loguru import logger

from app.core.config import settings
from app.core.exceptions import BookStackConnectionError
from app.domain.schemas import BookStackBook, BookStackChapter, BookStackPage


class BookStackClient:
    """Async HTTP client for the BookStack API (Single Responsibility)."""

    def __init__(self) -> None:
        self.base_url = settings.BOOKSTACK_URL.rstrip("/")
        self.headers = {
            "Authorization": f"Token {settings.BOOKSTACK_TOKEN_ID}:{settings.BOOKSTACK_TOKEN_SECRET}",
            "Content-Type": "application/json",
        }
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy-init async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.headers,
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        """Cleanup HTTP client on shutdown."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # --- Page Operations ---

    async def list_pages(
        self, offset: int = 0, count: int = 100, updated_after: Optional[str] = None
    ) -> List[BookStackPage]:
        """Fetch paginated list of pages, optionally filtered by updated_at."""
        client = await self._get_client()
        params: dict = {"offset": offset, "count": count, "sort": "-updated_at"}

        if updated_after:
            params["filter[updated_at:gt]"] = updated_after

        try:
            resp = await client.get("/api/pages", params=params)
            resp.raise_for_status()
            data = resp.json()
            return [BookStackPage(**page) for page in data.get("data", [])]
        except httpx.HTTPError as e:
            logger.error(f"BookStack list_pages failed: {e}")
            raise BookStackConnectionError(detail=f"Failed to list pages: {e}")

    async def get_page(self, page_id: int) -> BookStackPage:
        """Fetch full page content by ID (includes HTML body)."""
        client = await self._get_client()
        try:
            resp = await client.get(f"/api/pages/{page_id}")
            resp.raise_for_status()
            return BookStackPage(**resp.json())
        except httpx.HTTPError as e:
            logger.error(f"BookStack get_page({page_id}) failed: {e}")
            raise BookStackConnectionError(detail=f"Failed to fetch page {page_id}: {e}")

    async def get_all_pages(self) -> List[BookStackPage]:
        """Fetch ALL pages using pagination (for full sync)."""
        all_pages: List[BookStackPage] = []
        offset = 0
        count = 100

        while True:
            batch = await self.list_pages(offset=offset, count=count)
            if not batch:
                break
            all_pages.extend(batch)
            if len(batch) < count:
                break  # last page
            offset += count

        logger.info(f"Fetched {len(all_pages)} total pages from BookStack")
        return all_pages

    async def get_pages_updated_after(self, timestamp: str) -> List[BookStackPage]:
        """Fetch pages updated after a given ISO timestamp (for delta sync)."""
        return await self.list_pages(updated_after=timestamp)

    # --- Book Operations ---

    async def list_books(self) -> List[BookStackBook]:
        """Fetch all books for metadata enrichment."""
        client = await self._get_client()
        try:
            resp = await client.get("/api/books", params={"count": 500})
            resp.raise_for_status()
            data = resp.json()
            return [BookStackBook(**book) for book in data.get("data", [])]
        except httpx.HTTPError as e:
            logger.error(f"BookStack list_books failed: {e}")
            raise BookStackConnectionError(detail=f"Failed to list books: {e}")

    async def get_books(self) -> List[BookStackBook]:
        """Backward-compatible alias used by health checks and older services."""
        return await self.list_books()

    # --- Chapter Operations ---

    async def list_chapters(self, offset: int = 0, count: int = 100) -> List[BookStackChapter]:
        """Fetch paginated list of chapters."""
        client = await self._get_client()
        params = {"offset": offset, "count": count}
        try:
            resp = await client.get("/api/chapters", params=params)
            resp.raise_for_status()
            data = resp.json()
            return [BookStackChapter(**chapter) for chapter in data.get("data", [])]
        except httpx.HTTPError as e:
            logger.error(f"BookStack list_chapters failed: {e}")
            raise BookStackConnectionError(detail=f"Failed to list chapters: {e}")

    async def get_all_chapters(self) -> List[BookStackChapter]:
        """Fetch all chapters using pagination."""
        all_chapters: List[BookStackChapter] = []
        offset = 0
        count = 100

        while True:
            batch = await self.list_chapters(offset=offset, count=count)
            if not batch:
                break
            all_chapters.extend(batch)
            if len(batch) < count:
                break
            offset += count

        logger.info(f"Fetched {len(all_chapters)} total chapters from BookStack")
        return all_chapters


# Singleton instance — injected into services
bookstack_client = BookStackClient()
