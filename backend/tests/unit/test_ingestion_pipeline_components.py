from types import SimpleNamespace

import pytest

from app.adapters.embedding_client import EmbeddingClient
from app.adapters.embeddings.base import EmbeddingProvider
from app.adapters.vector_store import VectorStore
from app.core.exceptions import EmbeddingError, VectorStoreError
from app.services.text_processor import TextProcessor


def test_text_processor_cleans_html_and_builds_chunks():
    processor = TextProcessor(chunk_size=120, chunk_overlap=20)
    html = """
    <html>
      <body>
        <nav>ignore this nav</nav>
        <h1>Authentication Guide</h1>
        <p>This section explains how to configure SSO for enterprise tenants.</p>
        <p>Use your identity provider metadata XML and verify callback URLs.</p>
        <footer>ignore footer</footer>
      </body>
    </html>
    """

    clean_text = processor.clean_html(html)
    assert "ignore this nav" not in clean_text.lower()
    assert "ignore footer" not in clean_text.lower()

    chunks = processor.chunk_text(
        text=(
            "Authentication Guide\n\n"
            "This section explains how to configure SSO for enterprise tenants.\n\n"
            "Use your identity provider metadata XML and verify callback URLs."
        ),
        page_id=42,
        metadata_base={
            "page_id": 42,
            "page_title": "SSO Setup",
            "book_id": 7,
            "book_title": "Admin Docs",
            "chapter_id": 3,
            "bookstack_url": "https://docs.example.com/books/admin/page/sso-setup",
        },
    )

    assert len(chunks) >= 2
    assert chunks[0].chunk_id == "page_42_chunk_0"
    assert chunks[0].metadata["page_id"] == 42
    assert chunks[0].metadata["page_title"] == "SSO Setup"
    assert chunks[0].metadata["book_id"] == 7
    assert chunks[0].metadata["chapter_id"] == 3
    assert chunks[0].metadata["bookstack_url"].endswith("/sso-setup")
    assert chunks[0].metadata["chunk_index"] == 0


@pytest.mark.asyncio
async def test_embedding_client_batches_and_returns_embeddings():
    captured_batches = []

    class FakeProvider(EmbeddingProvider):
        provider_name = "fake"
        model_name = "fake-embedding-model"
        dimensions = 2

        async def embed_text(self, text: str):
            return (await self.embed_texts([text]))[0]

        async def embed_texts(self, texts):
            all_embeddings = []
            for i in range(0, len(texts), 2048):
                batch = texts[i : i + 2048]
                captured_batches.append((self.model_name, list(batch)))
                all_embeddings.extend(
                    [
                        [float(index), float(index) + 0.5]
                        for index, _ in enumerate(batch)
                    ]
                )
            return all_embeddings

    client = EmbeddingClient(provider=FakeProvider())

    texts = [f"text-{index}" for index in range(2050)]
    embeddings = await client.embed_texts(texts)

    assert len(embeddings) == 2050
    assert len(captured_batches) == 2
    assert len(captured_batches[0][1]) == 2048
    assert len(captured_batches[1][1]) == 2
    assert captured_batches[0][0] == client.model


@pytest.mark.asyncio
async def test_embedding_client_maps_failures_to_embedding_error():
    class FailingProvider(EmbeddingProvider):
        provider_name = "fake"
        model_name = "fake-embedding-model"
        dimensions = 2

        async def embed_text(self, text: str):
            return (await self.embed_texts([text]))[0]

        async def embed_texts(self, texts):
            raise EmbeddingError(detail="Azure embedding failed: boom")

    client = EmbeddingClient(provider=FailingProvider())

    with pytest.raises(EmbeddingError) as exc:
        await client.embed_texts(["hello"])

    assert "Azure embedding failed" in exc.value.detail


@pytest.mark.asyncio
async def test_vector_store_upsert_batches_records_and_query_maps_results():
    upsert_calls = []
    query_calls = []

    class FakeIndex:
        def upsert(self, *, vectors, namespace):
            upsert_calls.append((vectors, namespace))

        def query(self, **kwargs):
            query_calls.append(kwargs)
            return {
                "matches": [
                    {
                        "id": "page_42_chunk_0",
                        "score": 0.93,
                        "metadata": {
                            "chunk_text": "SSO configuration steps",
                            "page_id": 42,
                            "page_title": "SSO Setup",
                            "bookstack_url": "https://docs.example.com/sso-setup",
                            "book_id": 7,
                        },
                    }
                ]
            }

    store = VectorStore()
    store._index = FakeIndex()

    ids = [f"chunk-{index}" for index in range(205)]
    # Use 3072 dimensions to match Azure OpenAI text-embedding-3-large
    vectors = [[float(index) for _ in range(3072)] for index in range(205)]
    metadatas = [{"page_id": 42, "chunk_text": f"chunk {index}"} for index in range(205)]

    upserted = await store.upsert_vectors(ids=ids, vectors=vectors, metadatas=metadatas)
    results = await store.query(vector=[0.1] * 3072, top_k=3, filter_dict={"page_id": {"$eq": 42}})

    assert upserted == 205
    assert len(upsert_calls) == 3
    assert len(upsert_calls[0][0]) == 100
    assert len(upsert_calls[1][0]) == 100
    assert len(upsert_calls[2][0]) == 5
    assert all(call[1] == store.NAMESPACE for call in upsert_calls)
    assert query_calls[0]["filter"] == {"page_id": {"$eq": 42}}
    assert results[0].chunk_id == "page_42_chunk_0"
    assert results[0].page_title == "SSO Setup"
    assert results[0].score == 0.93


@pytest.mark.asyncio
async def test_vector_store_maps_upsert_failures_to_domain_error():
    class FailingIndex:
        def upsert(self, *, vectors, namespace):
            raise RuntimeError("pinecone down")

    store = VectorStore()
    store._index = FailingIndex()

    with pytest.raises(VectorStoreError) as exc:
        await store.upsert_vectors(
            ids=["chunk-1"],
            vectors=[[0.1, 0.2]],
            metadatas=[{"page_id": 42, "chunk_text": "text"}],
        )

    assert "Failed to upsert vectors" in exc.value.detail


@pytest.mark.asyncio
async def test_chunk_to_embedding_to_vector_pipeline():
    processor = TextProcessor(chunk_size=90, chunk_overlap=15)
    html = """
    <h1>Audit Logs</h1>
    <p>Audit logs record authentication events, API key usage, and admin actions.</p>
    <p>Export logs daily and store them in your SIEM for compliance workflows.</p>
    """

    chunks = processor.process_page(
        page_id=99,
        html_content=html,
        page_title="Audit Logs",
        book_id=11,
        book_title="Security Docs",
        chapter_id=4,
        bookstack_url="https://docs.example.com/security/audit-logs",
    )

    assert chunks

    class FakeProvider(EmbeddingProvider):
        provider_name = "fake"
        model_name = "fake-embedding-model"
        dimensions = 2

        async def embed_text(self, text: str):
            return (await self.embed_texts([text]))[0]

        async def embed_texts(self, texts):
            return [
                [float(index)] * 3072 if text else [0.0] * 3072
                for index, text in enumerate(texts)
            ]

    stored_batches = []

    class FakeIndex:
        def upsert(self, *, vectors, namespace):
            stored_batches.append((vectors, namespace))

    embedding_client = EmbeddingClient(provider=FakeProvider())

    vector_store = VectorStore()
    vector_store._index = FakeIndex()

    embeddings = await embedding_client.embed_texts([chunk.text for chunk in chunks])
    upserted = await vector_store.upsert_vectors(
        ids=[chunk.chunk_id for chunk in chunks],
        vectors=embeddings,
        metadatas=[chunk.metadata for chunk in chunks],
    )

    assert len(embeddings) == len(chunks)
    assert upserted == len(chunks)
    assert len(stored_batches) == 1
    first_record = stored_batches[0][0][0]
    assert first_record["id"].startswith("page_99_chunk_")
    assert first_record["metadata"]["page_title"] == "Audit Logs"
    assert stored_batches[0][1] == vector_store.NAMESPACE
