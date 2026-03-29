"""Text processor — cleans HTML and chunks text for embedding."""

import re
from zlib import crc32
from typing import List

from bs4 import BeautifulSoup
from loguru import logger

from app.core.config import settings
from app.domain.schemas import NormalizedDocument, TextChunk


class TextProcessor:
    """Handles HTML→text extraction and semantic chunking (SRP)."""

    def __init__(
        self,
        chunk_size: int = settings.CHUNK_SIZE,
        chunk_overlap: int = settings.CHUNK_OVERLAP,
    ) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def clean_html(self, html: str) -> str:
        """Strip HTML tags, normalize whitespace, preserve structure."""
        if not html:
            return ""

        soup = BeautifulSoup(html, "lxml")

        # Remove script/style elements
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()

        # Extract text with newlines at block boundaries
        text = soup.get_text(separator="\n", strip=True)

        # Normalize multiple newlines/spaces
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)

        return text.strip()

    def clean_markdown(self, markdown_text: str) -> str:
        """Normalize markdown/plain-text docs into chunkable text."""
        if not markdown_text:
            return ""

        text = markdown_text.replace("\r\n", "\n")
        text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"\[(?P<label>[^\]]+)\]\((?P<url>[^)]+)\)", r"\g<label>", text)
        # text = re.sub(r"`{1,3}", "", text)  # DO NOT STRIP CODE SYNTAX
        text = re.sub(r"[*_~]{1,2}", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]{2,}", " ", text)
        return text.strip()

    def chunk_text(
        self,
        text: str,
        page_id: int,
        metadata_base: dict,
        chunk_id_prefix: str | None = None,
    ) -> List[TextChunk]:
        """High-Res Retrieval Strategy: Split into 800-char overlapping chunks for precise matching."""
        if not text or len(text.strip()) < 50:
            return []

        chunks: List[TextChunk] = []
        # Split by paragraphs first, then merge into chunk_size windows
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            # If adding this paragraph exceeds chunk_size, save current and start new
            if current_chunk and (len(current_chunk) + len(para) + 2) > self.chunk_size:
                chunks.append(self._build_chunk(
                    current_chunk, page_id, chunk_index, metadata_base, chunk_id_prefix=chunk_id_prefix
                ))
                chunk_index += 1

                # Overlap: keep tail of current chunk
                overlap_text = current_chunk[-self.chunk_overlap :] if len(current_chunk) > self.chunk_overlap else current_chunk
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk = (current_chunk + "\n\n" + para).strip() if current_chunk else para

        # Flush remaining text
        if current_chunk.strip():
            chunks.append(self._build_chunk(
                current_chunk, page_id, chunk_index, metadata_base, chunk_id_prefix=chunk_id_prefix
            ))

        logger.info(f"Page {page_id}: split into {len(chunks)} high-res chunks")
        return chunks

    def _build_chunk(
        self,
        text: str,
        page_id: int,
        chunk_index: int,
        metadata_base: dict,
        chunk_id_prefix: str | None = None,
    ) -> TextChunk:
        """Construct a TextChunk with Pinecone-ready metadata and breadcrumbs."""
        # --- BREADCRUMB INJECTION ---
        page_title = metadata_base.get("page_title", "Untitled")
        source_name = metadata_base.get("source_name", "")
        
        # Clean breadcrumb
        clean_title = re.sub(r"^#{1,6}\s*", "", page_title).strip()
        prefix = f"Doc: {clean_title} | "
        
        contextualized_text = prefix + text
        # ---------------------------

        chunk_id = (
            f"{chunk_id_prefix}::chunk::{chunk_index}"
            if chunk_id_prefix
            else f"page_{page_id}_chunk_{chunk_index}"
        )
        metadata = {
            **metadata_base,
            "chunk_text": contextualized_text[:1000],  # Pinecone metadata limit safety
            "chunk_index": chunk_index,
        }
        return TextChunk(chunk_id=chunk_id, text=contextualized_text, metadata=metadata)

    def process_page(
        self,
        page_id: int,
        html_content: str,
        page_title: str,
        book_id: int = 0,
        book_title: str = "",
        chapter_id: int = 0,
        bookstack_url: str = "",
    ) -> List[TextChunk]:
        """Full pipeline: HTML → clean text → chunks with metadata."""
        clean_text = self.clean_html(html_content)

        metadata_base = {
            "page_id": page_id,
            "page_title": page_title,
            "book_id": book_id,
            "book_title": book_title,
            "chapter_id": chapter_id,
            "bookstack_url": bookstack_url,
            "source_url": bookstack_url,
            "source_type": "bookstack",
            "source_name": book_title,
            "full_doc_text": html_content,  # Original source for LLM
        }

        return self.chunk_text(clean_text, page_id, metadata_base)

    def process_document_text(
        self,
        *,
        page_id: int,
        text_content: str,
        page_title: str,
        source_url: str = "",
        source_type: str = "local_markdown",
        source_name: str = "",
        collection_id: int = 0,
        chapter_id: int = 0,
    ) -> List[TextChunk]:
        """Process plain text or markdown docs into chunks with generic metadata."""
        clean_text = self.clean_markdown(text_content)
        metadata_base = {
            "page_id": page_id,
            "page_title": page_title,
            "book_id": collection_id,
            "book_title": source_name,
            "chapter_id": chapter_id,
            "bookstack_url": source_url,
            "source_url": source_url,
            "source_type": source_type,
            "source_name": source_name,
            "full_doc_text": text_content,  # Original source for LLM
        }
        return self.chunk_text(clean_text, page_id, metadata_base)

    def process_document(self, document: NormalizedDocument) -> List[TextChunk]:
        """Process a normalized provider document into generic retrieval chunks."""
        if document.content_format.value == "html":
            clean_text = self.clean_html(document.content)
        else:
            clean_text = self.clean_markdown(document.content)

        metadata = document.metadata or {}
        page_id = self._resolve_numeric_document_id(document)
        metadata_base = {
            "page_id": page_id,
            "page_title": document.title,
            "book_id": int(metadata.get("book_id") or 0),
            "book_title": metadata.get("book_title") or document.container_name,
            "chapter_id": int(metadata.get("chapter_id") or 0),
            "bookstack_url": document.source_url,
            "source_url": document.source_url,
            "source_type": document.provider_type.value,
            "source_name": document.container_name,
            "source_key": document.source_key,
            "external_document_id": document.external_document_id,
            "document_uid": document.document_uid,
            "full_doc_text": document.content,  # Original source for LLM
        }

        return self.chunk_text(
            clean_text,
            page_id,
            metadata_base,
            chunk_id_prefix=document.document_uid,
        )

    def _resolve_numeric_document_id(self, document: NormalizedDocument) -> int:
        page_id = document.metadata.get("page_id") if document.metadata else None
        if isinstance(page_id, int) and page_id > 0:
            return page_id
        try:
            return int(document.external_document_id)
        except ValueError:
            checksum = crc32(document.document_uid.encode("utf-8"))
            return checksum & 0x7FFFFFFF


# Singleton instance
text_processor = TextProcessor()
