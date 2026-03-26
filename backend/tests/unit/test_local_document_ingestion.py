from pathlib import Path

from app.core.config import Settings
from app.services.local_document_ingestion import LocalDocumentIngestionService
from scripts.ingest_docs_to_pinecone import collect_input_files


def test_settings_env_file_points_to_backend_dotenv():
    env_file = Path(Settings.model_config["env_file"])

    assert env_file.name == ".env"
    assert env_file.parent.name == "backend"


def test_local_document_ingestion_builds_rag_compatible_chunks(tmp_path):
    filepath = tmp_path / "07-security-compliance-administration.md"
    filepath.write_text(
        "# Security Architecture\n\n"
        "Authentication relies on tenant-aware access control and audit logging. " * 10,
        encoding="utf-8",
    )

    service = LocalDocumentIngestionService()
    chunks = service.build_chunks(filepath)

    assert chunks
    assert chunks[0].chunk_id == "page_7_chunk_0"
    assert chunks[0].metadata["page_id"] == 7
    assert chunks[0].metadata["page_title"] == "Security Architecture"
    assert chunks[0].metadata["source_type"] == "local_markdown"
    assert chunks[0].metadata["source_name"] == filepath.name
    assert chunks[0].metadata["bookstack_url"] == str(filepath.resolve())
    assert chunks[0].metadata["chunk_text"]


def test_collect_input_files_accepts_file_and_directory_paths(tmp_path):
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    first = docs_dir / "01-overview.md"
    second = docs_dir / "02-guide.txt"
    ignored = docs_dir / "image.png"
    first.write_text("# Overview\n\nhello world", encoding="utf-8")
    second.write_text("plain text content", encoding="utf-8")
    ignored.write_bytes(b"not-a-doc")

    files = collect_input_files([str(first), str(docs_dir)], docs_dir)

    assert files == [first.resolve(), second.resolve()]
