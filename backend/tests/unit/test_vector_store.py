import pytest

from app.adapters.vector_store import VectorStore


@pytest.mark.asyncio
async def test_delete_all_is_noop_when_namespace_is_missing():
    class MissingNamespaceIndex:
        def delete(self, **kwargs):
            raise RuntimeError("Namespace not found")

    store = VectorStore()
    store._index = MissingNamespaceIndex()

    await store.delete_all()


@pytest.mark.asyncio
async def test_delete_by_page_id_is_noop_when_namespace_is_missing():
    class MissingNamespaceIndex:
        def delete(self, **kwargs):
            raise RuntimeError("Namespace not found")

    store = VectorStore()
    store._index = MissingNamespaceIndex()

    await store.delete_by_page_id(42)


@pytest.mark.asyncio
async def test_delete_by_source_type_targets_source_filter():
    calls = []

    class RecordingIndex:
        def delete(self, **kwargs):
            calls.append(kwargs)

    store = VectorStore()
    store._index = RecordingIndex()

    await store.delete_by_source_type("bookstack")

    assert calls == [
        {
            "filter": {"source_type": {"$eq": "bookstack"}},
            "namespace": store.NAMESPACE,
        }
    ]
