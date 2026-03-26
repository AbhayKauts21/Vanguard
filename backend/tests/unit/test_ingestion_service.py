from app.core.exceptions import BookStackConnectionError
from app.services.ingestion_service import IngestionService


class RecordingVectorStore:
    def __init__(self) -> None:
        self.delete_all_calls = 0

    async def delete_all(self) -> None:
        self.delete_all_calls += 1


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
