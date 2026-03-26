import pytest

from app.adapters.vector_store import VectorStore


@pytest.mark.asyncio
async def test_vector_store_prefers_namespace_count_when_total_is_zero():
    class FakeIndex:
        def describe_index_stats(self):
            return {
                "total_vector_count": 0,
                "namespaces": {
                    "bookstack": {"vector_count": 162},
                    "other": {"vector_count": 10},
                },
            }

    store = VectorStore()
    store._index = FakeIndex()

    stats = await store.get_index_stats()

    assert stats["namespace_vectors"] == 162
    assert stats["total_vectors"] == 162


@pytest.mark.asyncio
async def test_vector_store_falls_back_to_global_count_when_namespace_missing():
    class FakeIndex:
        def describe_index_stats(self):
            return {
                "total_vector_count": 55,
                "namespaces": {
                    "other": {"vector_count": 55},
                },
            }

    store = VectorStore()
    store._index = FakeIndex()

    stats = await store.get_index_stats()

    assert stats["namespace_vectors"] == 0
    assert stats["total_vectors"] == 55
