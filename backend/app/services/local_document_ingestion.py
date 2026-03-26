"""Helpers for ingesting local markdown files into Pinecone."""

import re
from pathlib import Path
from typing import Dict, List
from zlib import crc32

from loguru import logger

from app.adapters.embedding_client import (
    EmbeddingClient,
    embedding_client as default_embedding_client,
)
from app.adapters.vector_store import vector_store as default_vector_store
from app.domain.schemas import TextChunk
from app.services.text_processor import (
    TextProcessor,
    text_processor as default_text_processor,
)


class LocalDocumentIngestionService:
    """Ingest local markdown docs with the same metadata contract used by RAG."""

    def __init__(
        self,
        *,
        embedding_client: EmbeddingClient = default_embedding_client,
        vector_store=default_vector_store,
        text_processor: TextProcessor = default_text_processor,
    ) -> None:
        self.embedding_client = embedding_client
        self.vector_store = vector_store
        self.text_processor = text_processor

    def read_document(self, filepath: Path) -> str:
        """Read a markdown document from disk."""
        return filepath.read_text(encoding="utf-8")

    def resolve_document_id(
        self,
        filepath: Path,
        *,
        fallback_index: int | None = None,
    ) -> int:
        """Return a stable integer id so re-ingestion replaces prior chunks."""
        match = re.match(r"^(?P<prefix>\d+)", filepath.stem)
        if match:
            return int(match.group("prefix"))
        if fallback_index is not None:
            return fallback_index
        checksum = crc32(str(filepath.resolve()).encode("utf-8")) & 0x7FFFFFFF
        return checksum or 1

    def extract_title(self, markdown_text: str, *, fallback_name: str) -> str:
        """Prefer the first markdown heading, then fall back to the file name."""
        for line in markdown_text.splitlines():
            stripped = line.strip()
            if not stripped or stripped == "---":
                continue
            if stripped.startswith("#"):
                title = re.sub(r"^#{1,6}\s*", "", stripped).strip()
                if title:
                    return title
        return fallback_name.replace("-", " ").replace("_", " ").title()

    def build_chunks(
        self,
        filepath: Path,
        *,
        fallback_index: int | None = None,
    ) -> List[TextChunk]:
        """Convert a local markdown file into chunk records ready for embedding."""
        markdown_text = self.read_document(filepath)
        document_id = self.resolve_document_id(filepath, fallback_index=fallback_index)
        title = self.extract_title(markdown_text, fallback_name=filepath.stem)

        chunks = self.text_processor.process_document_text(
            page_id=document_id,
            text_content=markdown_text,
            page_title=title,
            source_url=str(filepath.resolve()),
            source_type="local_markdown",
            source_name=filepath.name,
        )

        for chunk in chunks:
            chunk.metadata["document_name"] = filepath.name
            chunk.metadata["document_path"] = str(filepath.resolve())
            chunk.metadata["document_stem"] = filepath.stem

        return chunks

    async def ingest_file(
        self,
        filepath: Path,
        *,
        fallback_index: int | None = None,
    ) -> Dict[str, int | str]:
        """Run read → chunk → embed → upsert for one local markdown file."""
        chunks = self.build_chunks(filepath, fallback_index=fallback_index)
        document_id = self.resolve_document_id(filepath, fallback_index=fallback_index)
        title = chunks[0].metadata["page_title"] if chunks else filepath.stem

        if not chunks:
            logger.warning("Document '{}' produced no chunks", filepath.name)
            return {
                "document_id": document_id,
                "title": title,
                "chunks_created": 0,
                "vectors_upserted": 0,
            }

        await self.vector_store.delete_by_page_id(document_id)

        vectors = await self.embedding_client.embed_texts([chunk.text for chunk in chunks])
        upserted = await self.vector_store.upsert_vectors(
            ids=[chunk.chunk_id for chunk in chunks],
            vectors=vectors,
            metadatas=[chunk.metadata for chunk in chunks],
        )

        return {
            "document_id": document_id,
            "title": title,
            "chunks_created": len(chunks),
            "vectors_upserted": upserted,
        }


local_document_ingestion_service = LocalDocumentIngestionService()
