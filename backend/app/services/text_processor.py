"""Text processor — cleans HTML and chunks text for embedding."""

import re
from typing import List

from bs4 import BeautifulSoup
from loguru import logger

from app.core.config import settings
from app.domain.schemas import TextChunk


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
        text = re.sub(r"`{1,3}", "", text)
        text = re.sub(r"[*_~]{1,2}", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]{2,}", " ", text)
        return text.strip()

    def chunk_text(
        self,
        text: str,
        page_id: int,
        metadata_base: dict,
    ) -> List[TextChunk]:
        """Split text into overlapping chunks with metadata."""
        if not text or len(text.strip()) < 50:
            return []  # skip near-empty pages

        chunks: List[TextChunk] = []
        # Split by paragraphs first, then merge into chunk_size windows
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            # If adding this paragraph exceeds chunk_size, save current and start new
            if current_chunk and (len(current_chunk) + len(para) + 2) > self.chunk_size:
                chunks.append(self._build_chunk(
                    current_chunk, page_id, chunk_index, metadata_base
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
                current_chunk, page_id, chunk_index, metadata_base
            ))

        logger.debug(f"Page {page_id}: split into {len(chunks)} chunks")
        return chunks

    def _build_chunk(
        self, text: str, page_id: int, chunk_index: int, metadata_base: dict
    ) -> TextChunk:
        """Construct a TextChunk with Pinecone-ready metadata."""
        chunk_id = f"page_{page_id}_chunk_{chunk_index}"
        metadata = {
            **metadata_base,
            "chunk_text": text[:1000],  # Pinecone metadata limit safety
            "chunk_index": chunk_index,
        }
        return TextChunk(chunk_id=chunk_id, text=text, metadata=metadata)

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
            "source_type": "bookstack",
            "source_name": book_title,
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
            "source_type": source_type,
            "source_name": source_name,
        }
        return self.chunk_text(clean_text, page_id, metadata_base)


# Singleton instance
text_processor = TextProcessor()
