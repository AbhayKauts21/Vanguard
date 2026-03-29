from app.services.ingestion_service import IngestionService


class RecordingDocumentSyncService:
    def __init__(self) -> None:
        self.calls = []

    async def full_sync(self, *, source_key: str):
        self.calls.append(("full_sync", source_key))
        return "ok"

    async def sync_document(self, *, source_key: str, external_document_id: str):
        self.calls.append(("sync_document", source_key, external_document_id))
        return "doc"

    async def delete_document(self, *, source_key: str, external_document_id: str):
        self.calls.append(("delete_document", source_key, external_document_id))

    async def get_status(self, *, source_key: str):
        self.calls.append(("get_status", source_key))
        return "status"

    async def delta_sync(self, *, source_key: str):
        self.calls.append(("delta_sync", source_key))
        return 3

    async def delete_by_source_type(self, source_type: str) -> None:
        self.calls.append(("delete_by_source_type", source_type))


def test_ingestion_service_delegates_to_document_sync_service():
    sync_service = RecordingDocumentSyncService()
    service = IngestionService(
        document_sync_service=sync_service,
    )

    import asyncio

    assert asyncio.run(service.full_sync()) == "ok"
    assert asyncio.run(service.ingest_single_page(42)) == "doc"
    asyncio.run(service.delete_page(42))
    assert asyncio.run(service.get_status()) == "status"
    assert asyncio.run(service.delta_sync()) == 3

    assert sync_service.calls == [
        ("full_sync", "bookstack_default"),
        ("sync_document", "bookstack_default", "42"),
        ("delete_document", "bookstack_default", "42"),
        ("get_status", "bookstack_default"),
        ("delta_sync", "bookstack_default"),
    ]
