from types import SimpleNamespace
import sys

import pytest

from app.adapters.embedding_client import EmbeddingClient
from app.adapters.embeddings.azure_provider import AzureEmbeddingProvider
from app.adapters.embeddings.factory import (
    build_embedding_provider,
    reset_embedding_provider,
)
from app.adapters.vector_store import VectorStore
from app.core.config import settings
from app.core.exceptions import VectorStoreError


def teardown_function():
    reset_embedding_provider()


def test_factory_builds_azure_provider():
    provider = build_embedding_provider()
    assert isinstance(provider, AzureEmbeddingProvider)


@pytest.mark.asyncio
async def test_azure_embedding_provider_builds_sdk_request(monkeypatch):
    captured = {}

    class FakeEmbeddings:
        def create(self, **kwargs):
            captured["payload"] = kwargs
            return SimpleNamespace(
                data=[SimpleNamespace(embedding=[0.1, 0.2, 0.3])]
            )

    class FakeAzureOpenAI:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs
            self.embeddings = FakeEmbeddings()

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(AzureOpenAI=FakeAzureOpenAI))
    monkeypatch.setattr(settings, "AZURE_OPENAI_ENDPOINT", "https://demo.openai.azure.com/")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_KEY", "secret")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_VERSION", "2024-10-21")
    monkeypatch.setattr(settings, "AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "embedding-prod")
    monkeypatch.setattr(settings, "AZURE_OPENAI_TIMEOUT_SECONDS", 12.0)
    monkeypatch.setattr(settings, "AZURE_OPENAI_MAX_RETRIES", 5)
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSIONS", 3072)

    provider = AzureEmbeddingProvider()
    result = await provider.embed_text("hello")

    assert result == [0.1, 0.2, 0.3]
    assert captured["client_kwargs"]["azure_endpoint"] == "https://demo.openai.azure.com/"
    assert captured["client_kwargs"]["api_version"] == "2024-10-21"
    assert captured["client_kwargs"]["timeout"] == 12.0
    assert captured["client_kwargs"]["max_retries"] == 5
    assert captured["payload"]["model"] == "embedding-prod"
    assert captured["payload"]["dimensions"] == 3072


@pytest.mark.asyncio
async def test_embedding_client_delegates_to_injected_provider():
    class FakeProvider:
        provider_name = "fake"
        model_name = "fake-model"
        dimensions = 3072

        async def embed_text(self, text):
            return [1.0, 2.0]

        async def embed_texts(self, texts):
            return [[float(index)] for index, _ in enumerate(texts)]

        def describe(self):
            return {
                "provider": self.provider_name,
                "model": self.model_name,
                "dimensions": self.dimensions,
            }

        def reset_client(self):
            return None

    client = EmbeddingClient(provider=FakeProvider())
    assert await client.embed_text("hello") == [1.0, 2.0]
    assert await client.embed_texts(["a", "b"]) == [[0.0], [1.0]]
    assert client.describe()["provider"] == "fake"


@pytest.mark.asyncio
async def test_vector_store_rejects_dimension_mismatch(monkeypatch):
    class FakeIndex:
        def query(self, **kwargs):
            return {"matches": []}

    monkeypatch.setattr(settings, "EMBEDDING_DIMENSIONS", 3072)
    store = VectorStore()
    store.expected_dimensions = 3072
    store._index = FakeIndex()

    with pytest.raises(VectorStoreError) as exc:
        await store.query(vector=[0.1, 0.2], top_k=5)

    assert "Vector dimension mismatch" in exc.value.detail
