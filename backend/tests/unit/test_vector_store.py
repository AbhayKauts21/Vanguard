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
