"""Seed a small demo knowledge base directly into Pinecone.

Useful when BookStack is not available but we still want to exercise:
- chunking
- Azure embeddings
- Pinecone upsert/query
- frontend -> /api/v1/chat end-to-end RAG flow
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
import sys
import zlib

sys.path.append(str(Path(__file__).resolve().parents[1]))

from loguru import logger

from app.adapters.embedding_client import embedding_client
from app.adapters.vector_store import vector_store
from app.services.text_processor import text_processor


@dataclass(frozen=True)
class DemoPage:
    page_id: int
    title: str
    slug: str
    book_id: int
    book_title: str
    chapter_id: int
    html: str

    @property
    def url(self) -> str:
        return f"https://demo.cleo.local/books/{self.book_id}/page/{self.slug}"


DEMO_PAGES = [
    DemoPage(
        page_id=9001,
        title="Password Reset Guide",
        slug="password-reset-guide",
        book_id=501,
        book_title="Support Docs",
        chapter_id=10,
        html="""
        <h1>Password Reset Guide</h1>
        <p>Users can reset their password from the account recovery page.</p>
        <p>To reset a password, click Forgot Password, enter the account email,
        and follow the secure link sent by email.</p>
        <p>If the reset email does not arrive, confirm the user is active and check spam filters.</p>
        <p>Administrators can force a password reset from the admin console under Users.</p>
        """,
    ),
    DemoPage(
        page_id=9002,
        title="Single Sign-On Setup",
        slug="single-sign-on-setup",
        book_id=501,
        book_title="Support Docs",
        chapter_id=11,
        html="""
        <h1>Single Sign-On Setup</h1>
        <p>CLEO supports SSO through a central identity provider.</p>
        <p>Configure the IdP metadata, verify redirect URLs, and assign users to the correct workspace role.</p>
        <p>Test with one pilot account before enabling SSO for the full organization.</p>
        <p>If sign-in loops occur, verify the assertion consumer service URL and the audience value.</p>
        """,
    ),
    DemoPage(
        page_id=9003,
        title="API Authentication",
        slug="api-authentication",
        book_id=502,
        book_title="Developer Docs",
        chapter_id=20,
        html="""
        <h1>API Authentication</h1>
        <p>API requests use bearer tokens issued after a successful login.</p>
        <p>Include the Authorization header with the value Bearer followed by the access token.</p>
        <p>Refresh tokens should never be sent to downstream services.</p>
        <p>If a request returns 401, confirm the access token is not expired and the header name is correct.</p>
        """,
    ),
]

LOCAL_DOC_SOURCE_NAME = "CheckingMate Product Docs"
LOCAL_DOC_COLLECTION_ID = 601


def _stable_page_id(path: Path) -> int:
    """Generate a stable numeric page id for local docs."""
    return 100_000 + (zlib.crc32(str(path).encode("utf-8")) % 900_000)


def _extract_title(path: Path, content: str) -> str:
    """Use the first markdown heading when available, else a cleaned filename."""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return path.stem.replace("-", " ").replace("_", " ").title()


async def _upsert_chunks(chunks, *, page_id: int, title: str) -> int:
    """Embed and upsert a batch of chunks for one logical page/document."""
    vectors = await embedding_client.embed_texts([chunk.text for chunk in chunks])
    await vector_store.upsert_vectors(
        ids=[chunk.chunk_id for chunk in chunks],
        vectors=vectors,
        metadatas=[chunk.metadata for chunk in chunks],
    )
    logger.info(f"Seeded page {page_id} '{title}' with {len(chunks)} chunks")
    return len(chunks)


async def _seed_demo_pages() -> int:
    """Seed the built-in demo docs."""
    total_chunks = 0
    for page in DEMO_PAGES:
        chunks = text_processor.process_page(
            page_id=page.page_id,
            html_content=page.html,
            page_title=page.title,
            book_id=page.book_id,
            book_title=page.book_title,
            chapter_id=page.chapter_id,
            bookstack_url=page.url,
        )

        if not chunks:
            logger.warning(f"Skipping demo page {page.page_id}; no chunks produced")
            continue

        total_chunks += await _upsert_chunks(
            chunks,
            page_id=page.page_id,
            title=page.title,
        )
    return total_chunks


async def _seed_local_markdown_files(markdown_files: list[str]) -> int:
    """Seed local markdown/plain-text docs into the shared knowledge base."""
    total_chunks = 0
    for raw_path in markdown_files:
        path = Path(raw_path).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"Markdown file not found: {path}")

        content = path.read_text(encoding="utf-8")
        title = _extract_title(path, content)
        page_id = _stable_page_id(path)
        source_url = path.as_uri()

        chunks = text_processor.process_document_text(
            page_id=page_id,
            text_content=content,
            page_title=title,
            source_url=source_url,
            source_type="local_markdown",
            source_name=LOCAL_DOC_SOURCE_NAME,
            collection_id=LOCAL_DOC_COLLECTION_ID,
        )

        if not chunks:
            logger.warning(f"Skipping local doc {path.name}; no chunks produced")
            continue

        total_chunks += await _upsert_chunks(
            chunks,
            page_id=page_id,
            title=title,
        )
    return total_chunks


async def seed_demo_docs(*, clear_first: bool, markdown_files: list[str]) -> None:
    """Chunk, embed, and upsert a small built-in dataset."""
    if clear_first:
        logger.info("Clearing Pinecone namespace before seeding demo docs")
        await vector_store.delete_all()

    total_chunks = await _seed_demo_pages()
    total_pages = len(DEMO_PAGES)

    if markdown_files:
        markdown_chunks = await _seed_local_markdown_files(markdown_files)
        total_chunks += markdown_chunks
        total_pages += len(markdown_files)

    logger.info(f"Demo Pinecone seed complete. Pages={total_pages} chunks={total_chunks}")
    print("\nSample questions to try in the frontend:")
    print("- How do I reset my password?")
    print("- How do I configure SSO?")
    print("- How do API requests authenticate?")
    print("- What should I check if a bearer token returns 401?")
    if markdown_files:
        print("- What is CheckingMate?")
        print("- How do I run CheckingMate locally?")
        print("- What databases does CheckingMate use?")
        print("- How does CheckingMate handle findings?")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed demo docs into Pinecone")
    parser.add_argument(
        "--clear-first",
        action="store_true",
        help="Delete the current Pinecone namespace before upserting demo docs.",
    )
    parser.add_argument(
        "--markdown-files",
        nargs="*",
        default=[],
        help="Optional local markdown or text files to ingest alongside the demo docs.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(
        seed_demo_docs(
            clear_first=args.clear_first,
            markdown_files=args.markdown_files,
        )
    )
