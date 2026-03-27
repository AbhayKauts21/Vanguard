from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.domain.schemas import DocumentContentFormat, DocumentProviderType, DocumentReference, NormalizedDocument
from app.services.document_sync_service import DocumentSyncService


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0
        self.added = []

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1

    def add(self, item) -> None:
        self.added.append(item)


def build_session_factory(session: FakeSession):
    @asynccontextmanager
    async def factory():
        yield session

    return factory


class FakeEmbeddingClient:
    def __init__(self) -> None:
        self.calls = []

    async def embed_texts(self, texts):
        self.calls.append(texts)
        return [[0.1] * 3072 for _ in texts]


class FakeVectorStore:
    def __init__(self) -> None:
        self.deleted = []
        self.upserts = []

    async def delete_by_document_uid(self, document_uid: str) -> None:
        self.deleted.append(document_uid)

    async def upsert_vectors(self, *, ids, vectors, metadatas):
        self.upserts.append((ids, vectors, metadatas))
        return len(ids)


def build_document() -> NormalizedDocument:
    return NormalizedDocument(
        source_key="bookstack_default",
        provider_type=DocumentProviderType.BOOKSTACK,
        external_document_id="42",
        external_parent_id="3",
        title="SSO Setup",
        content="<h1>SSO Setup</h1><p>Configure SSO for enterprise tenants.</p>" * 8,
        content_format=DocumentContentFormat.HTML,
        source_url="https://docs.example.com/books/7/page/sso-setup",
        container_name="Admin Docs",
        provider_updated_at=datetime(2026, 3, 27, 10, 0, tzinfo=timezone.utc),
        checksum="abc123",
        metadata={"page_id": 42, "book_id": 7, "book_title": "Admin Docs", "chapter_id": 3},
    )


@pytest.mark.asyncio
async def test_sync_reference_skips_unchanged_document(monkeypatch):
    session = FakeSession()
    service = DocumentSyncService(
        session_factory=build_session_factory(session),
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(),
    )

    document = build_document()
    existing = SimpleNamespace(
        is_deleted=False,
        checksum=document.checksum,
        provider_updated_at=document.provider_updated_at,
        title=document.title,
        last_synced_at=None,
        last_error="boom",
    )

    async def fake_get_document_by_external_id(*_args, **_kwargs):
        return existing

    monkeypatch.setattr(
        "app.services.document_sync_service.document_repository.get_document_by_external_id",
        fake_get_document_by_external_id,
    )

    class FakeProvider:
        async def get_document(self, _external_document_id: str, *, reference=None):
            return document

    outcome = await service._sync_reference(
        session=session,
        source=SimpleNamespace(id=uuid4(), source_key="bookstack_default"),
        provider=FakeProvider(),
        reference=DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="42",
        ),
    )

    assert outcome["status"] == "skipped"
    assert session.commits == 1
    assert existing.last_error is None


@pytest.mark.asyncio
async def test_sync_reference_upserts_changed_document(monkeypatch):
    session = FakeSession()
    embedding_client = FakeEmbeddingClient()
    vector_store = FakeVectorStore()
    service = DocumentSyncService(
        session_factory=build_session_factory(session),
        embedding_client=embedding_client,
        vector_store=vector_store,
    )

    async def fake_get_document_by_external_id(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.document_sync_service.document_repository.get_document_by_external_id",
        fake_get_document_by_external_id,
    )

    class FakeProvider:
        async def get_document(self, _external_document_id: str, *, reference=None):
            return build_document()

    outcome = await service._sync_reference(
        session=session,
        source=SimpleNamespace(id=uuid4(), source_key="bookstack_default"),
        provider=FakeProvider(),
        reference=DocumentReference(
            source_key="bookstack_default",
            provider_type=DocumentProviderType.BOOKSTACK,
            external_document_id="42",
        ),
    )

    assert outcome["status"] == "upserted"
    assert outcome["chunks_created"] >= 1
    assert embedding_client.calls
    assert vector_store.deleted == ["bookstack_default:42"]
    ids, _vectors, metadatas = vector_store.upserts[0]
    assert ids[0].startswith("bookstack_default:42::chunk::")
    assert metadatas[0]["document_uid"] == "bookstack_default:42"
    assert metadatas[0]["source_key"] == "bookstack_default"
