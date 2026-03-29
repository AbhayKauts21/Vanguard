#!/usr/bin/env python3
"""Ingest local markdown docs into Pinecone with RAG-compatible metadata."""

import argparse
import asyncio
import sys
from pathlib import Path
from typing import List

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger

from app.core.config import settings
from app.services.local_document_ingestion import LocalDocumentIngestionService

# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)


class DocumentIngester:
    """Handles document ingestion pipeline for local markdown docs."""

    def __init__(self):
        self.ingestion_service = LocalDocumentIngestionService()
        self.stats = {
            "files_processed": 0,
            "chunks_created": 0,
            "vectors_upserted": 0,
            "errors": 0,
        }

    async def ingest_document(self, filepath: Path, fallback_index: int, base_url: str | None = None) -> int:
        """
        Complete ingestion pipeline for a single document.
        Returns count of vectors upserted.
        """
        logger.info(f"\n{'='*70}")
        logger.info(f"Processing: {filepath.name}")
        logger.info(f"{'='*70}")

        try:
            # Build chunks first
            chunks = self.ingestion_service.build_chunks(
                filepath,
                fallback_index=fallback_index,
            )
            
            # If base_url is provided, override the source_url in metadata
            if base_url:
                # Use filename stem for the URL path.
                slug = filepath.stem
                # Special case: strip prefix for the overview doc as requested
                if slug == "01-overview-architecture":
                    slug = "overview-architecture"
                    
                target_url = f"{base_url.rstrip('/')}/{slug}"
                for chunk in chunks:
                    chunk.metadata["source_url"] = target_url
                    chunk.metadata["bookstack_url"] = target_url

            document_id = self.ingestion_service.resolve_document_id(
                filepath, 
                fallback_index=fallback_index
            )
            
            # Upsert
            await self.ingestion_service.vector_store.delete_by_page_id(document_id)
            vectors = await self.ingestion_service.embedding_client.embed_texts([c.text for c in chunks])
            upserted = await self.ingestion_service.vector_store.upsert_vectors(
                ids=[c.chunk_id for c in chunks],
                vectors=vectors,
                metadatas=[c.metadata for c in chunks],
            )

            result = {
                "document_id": document_id,
                "chunks_created": len(chunks),
                "vectors_upserted": upserted
            }

            self.stats["chunks_created"] += int(result["chunks_created"])
            self.stats["vectors_upserted"] += int(result["vectors_upserted"])
            self.stats["files_processed"] += 1

            logger.info(
                "✓ {} ingested successfully (doc_id={}, chunks={}, vectors={})\n".format(
                    filepath.name,
                    result["document_id"],
                    result["chunks_created"],
                    result["vectors_upserted"],
                )
            )
            return int(result["vectors_upserted"])

        except Exception as e:
            logger.error(f"✗ Ingestion failed for {filepath}: {e}\n")
            self.stats["errors"] += 1
            return 0

    async def ingest_all(self, files: List[Path], base_url: str | None = None) -> None:
        """Ingest multiple documents sequentially."""
        logger.info(f"\n{'='*70}")
        logger.info(f"DOCUMENT INGESTION PIPELINE - PINECONE")
        logger.info(f"{'='*70}")
        logger.info(f"Embedding Model: {self.ingestion_service.embedding_client.model}")
        logger.info(
            f"Embedding Dimensions: {self.ingestion_service.embedding_client.dimensions}"
        )
        logger.info(f"Chunk Size: {settings.CHUNK_SIZE} chars | Overlap: {settings.CHUNK_OVERLAP} chars")
        logger.info(f"Pinecone Index: {settings.PINECONE_INDEX_NAME}")
        logger.info(f"Pinecone Namespace: {self.ingestion_service.vector_store.NAMESPACE}")
        if base_url:
            logger.info(f"Base URL: {base_url}")
        logger.info(f"Total Documents to Ingest: {len(files)}")
        logger.info(f"{'='*70}")

        for fallback_index, filepath in enumerate(files, start=1):
            await self.ingest_document(filepath, fallback_index, base_url=base_url)

        # Final report
        logger.info(f"\n{'='*70}")
        logger.info(f"INGESTION COMPLETE")
        logger.info(f"{'='*70}")
        logger.info(f"Files Processed: {self.stats['files_processed']}")
        logger.info(f"Total Chunks Created: {self.stats['chunks_created']}")
        logger.info(f"Total Vectors Upserted: {self.stats['vectors_upserted']}")
        logger.info(f"Errors: {self.stats['errors']}")
        stats = await self.ingestion_service.vector_store.get_index_stats()
        namespace_stats = stats.get("namespaces", {}).get(
            self.ingestion_service.vector_store.NAMESPACE,
            {},
        )
        logger.info(f"Namespace Vector Count: {namespace_stats.get('vector_count', 0)}")
        logger.info(f"{'='*70}\n")

        if self.stats["errors"] == 0:
            logger.info("✓✓✓ All documents ingested successfully! ✓✓✓")
        else:
            logger.warning(f"⚠ {self.stats['errors']} document(s) failed to ingest")


SUPPORTED_EXTENSIONS = {".md", ".markdown", ".txt"}


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for path-driven ingestion."""
    parser = argparse.ArgumentParser(
        description=(
            "Ingest local text documents into Pinecone. "
            "Pass one or more file or directory paths. "
            "If omitted, scripts/temp_docs is used."
        )
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="File or directory paths to ingest.",
    )
    parser.add_argument(
        "--base-url",
        help="Optional base URL to prefix filenames with (e.g. https://bookstack/pages/)",
    )
    return parser.parse_args()


def collect_input_files(paths: List[str], default_dir: Path) -> List[Path]:
    """Resolve CLI paths into a deduplicated ordered list of ingestible files."""
    requested = [Path(raw).expanduser() for raw in paths] or [default_dir]
    files: List[Path] = []

    for requested_path in requested:
        candidate = requested_path.resolve()
        if not candidate.exists():
            raise FileNotFoundError(f"Path does not exist: {candidate}")

        if candidate.is_dir():
            directory_files = sorted(
                file_path
                for file_path in candidate.rglob("*")
                if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS
            )
            if not directory_files:
                raise FileNotFoundError(
                    f"No supported files found in directory: {candidate}"
                )
            files.extend(directory_files)
            continue

        if candidate.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type for {candidate}. "
                f"Supported extensions: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )
        files.append(candidate)

    deduped_files: List[Path] = []
    seen: set[Path] = set()
    for file_path in files:
        if file_path in seen:
            continue
        seen.add(file_path)
        deduped_files.append(file_path)

    return deduped_files


def main():
    """Main entry point."""
    args = parse_args()

    # Determine docs directory - use local temp_docs directory
    script_dir = Path(__file__).parent
    docs_dir = script_dir / "temp_docs"

    try:
        files = collect_input_files(args.paths, docs_dir)
    except Exception as exc:
        logger.error(str(exc))
        sys.exit(1)

    logger.info(f"\nFound {len(files)} file(s) to ingest:")
    for file_path in files:
        logger.info(f"  - {file_path}")

    # Run ingestion
    ingester = DocumentIngester()
    
    try:
        asyncio.run(ingester.ingest_all(files, base_url=args.base_url))
        sys.exit(0 if ingester.stats["errors"] == 0 else 1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
