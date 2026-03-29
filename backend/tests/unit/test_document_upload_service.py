from __future__ import annotations

from io import BytesIO

import pytest
import pytest_asyncio
from fastapi import BackgroundTasks, UploadFile
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import User
from app.domain.schemas import DocumentUploadStatus
from app.repositories.document_repository import document_repository
from app.services.document_upload_service import DocumentUploadService


class FakeBlobStorage:
    def __init__(self) -> None:
        self.uploads = []

    async def upload_bytes(self, *, blob_name: str, data: bytes, content_type: str) -> str:
        self.uploads.append((blob_name, data, content_type))
        return f"https://blob.example.com/{blob_name}"

    async def generate_access_url(self, *, blob_name: str) -> str:
        return f"https://blob.example.com/{blob_name}?sig=test"


class FakeEmbeddingClient:
    async def embed_texts(self, texts: list[str]):
        return [[0.1, 0.2, 0.3] for _ in texts]


class FakeVectorStore:
    def __init__(self) -> None:
        self.deleted = []
        self.upserts = []

    async def delete_by_document_uid(self, document_uid: str) -> None:
        self.deleted.append(document_uid)

    async def upsert_vectors(self, *, ids, vectors, metadatas):
        self.upserts.append(
            {
                "ids": ids,
                "vectors": vectors,
                "metadatas": metadatas,
            }
        )
        return len(ids)


@pytest_asyncio.fixture
async def upload_context():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        user = User(
            email="uploader@example.com",
            full_name="Uploader",
            password_hash="not-real",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    yield session_factory, user
    await engine.dispose()


@pytest.mark.asyncio
async def test_process_markdown_document_indexes_user_scoped_metadata(upload_context):
    session_factory, user = upload_context
    blob_storage = FakeBlobStorage()
    vector_store = FakeVectorStore()
    service = DocumentUploadService(
        session_factory=session_factory,
        embedding_client=FakeEmbeddingClient(),
        vector_store=vector_store,
        blob_storage=blob_storage,
    )

    payload = b"# Team Notes\n\nCustomer onboarding runbook.\n\nEscalate blockers quickly."

    async with session_factory() as session:
        upload = UploadFile(filename="team-notes.md", file=BytesIO(payload))
        response = await service.upload_document(
            session,
            current_user=user,
            file=upload,
            background_tasks=BackgroundTasks(),
            title="Team Notes",
            tags=["internal", "runbook"],
        )

    await service.process_document(response.id, payload)

    async with session_factory() as session:
        document = await document_repository.get_uploaded_document_by_id(session, response.id)

    assert document is not None
    assert document.status == DocumentUploadStatus.READY.value
    assert vector_store.deleted == [str(document.id)]
    metadata = vector_store.upserts[0]["metadatas"][0]
    assert metadata["document_id"] == str(document.id)
    assert metadata["blob_url"] == document.blob_url
    assert metadata["file_name"] == "team-notes.md"
    assert metadata["user_id"] == str(user.id)
    assert metadata["source"] == "user_upload"
    assert metadata["source_type"] == "user_upload"


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_file_types(upload_context):
    session_factory, user = upload_context
    service = DocumentUploadService(
        session_factory=session_factory,
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(),
        blob_storage=FakeBlobStorage(),
    )

    async with session_factory() as session:
        upload = UploadFile(filename="notes.txt", file=BytesIO(b"hello"))
        with pytest.raises(Exception) as exc_info:
            await service.upload_document(
                session,
                current_user=user,
                file=upload,
                background_tasks=BackgroundTasks(),
            )

    assert "PDF and Markdown" in str(exc_info.value)
