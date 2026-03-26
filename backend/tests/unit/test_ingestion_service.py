from app.core.exceptions import BookStackConnectionError
from app.services.ingestion_service import IngestionService


class RecordingVectorStore:
    def __init__(self) -> None:
        self.delete_all_calls = 0
        self.deleted_source_types: list[str] = []

    async def delete_all(self) -> None:
        self.delete_all_calls += 1

    async def delete_by_source_type(self, source_type: str) -> None:
        self.deleted_source_types.append(source_type)


class FailingBookStackClient:
    async def get_all_pages(self):
        raise BookStackConnectionError(detail="BookStack offline")


def test_full_sync_does_not_clear_index_when_bookstack_fetch_fails():
    service = IngestionService(
        bookstack_client=FailingBookStackClient(),
        vector_store=RecordingVectorStore(),
    )

    try:
        import asyncio

        asyncio.run(service.full_sync())
    except Exception:
        pass

    assert service.vector_store.delete_all_calls == 0
    assert service.vector_store.deleted_source_types == []


def test_full_sync_clears_only_bookstack_vectors_before_reingest():
    class WorkingBookStackClient:
        async def get_all_pages(self):
            from types import SimpleNamespace

            return [SimpleNamespace(id=101)]

    service = IngestionService(
        bookstack_client=WorkingBookStackClient(),
        vector_store=RecordingVectorStore(),
    )

    async def fake_ingest_single_page(page_id: int):
        from types import SimpleNamespace

        return SimpleNamespace(chunks_created=4, page_id=page_id)

    service.ingest_single_page = fake_ingest_single_page  # type: ignore[method-assign]

    import asyncio

    result = asyncio.run(service.full_sync())

    assert result.total_pages == 1
    assert result.total_chunks == 4
    assert service.vector_store.delete_all_calls == 0
    assert service.vector_store.deleted_source_types == ["bookstack"]
