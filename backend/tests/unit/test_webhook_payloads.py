import pytest

from app.api.router_webhook import _process_webhook
from app.domain.schemas import BookStackWebhookPayload


def test_bookstack_webhook_payload_accepts_realistic_page_event_without_type_field():
    payload = BookStackWebhookPayload(
        event="page_update",
        text="Page updated",
        triggered_at="2026-03-26T00:00:00Z",
        triggered_by={"id": 1, "name": "Admin User", "slug": "admin-user"},
        webhook_id=12,
        webhook_name="Docs Sync",
        url="https://docs.example.com/books/1/page/getting-started",
        related_item={
            "id": 42,
            "book_id": 1,
            "chapter_id": 7,
            "name": "Getting Started",
            "slug": "getting-started",
            "priority": 0,
            "draft": False,
            "revision_count": 3,
            "template": False,
            "created_at": "2026-03-25T00:00:00Z",
            "updated_at": "2026-03-26T00:00:00Z",
        },
    )

    assert payload.event == "page_update"
    assert payload.related_item is not None
    assert payload.related_item.id == 42
    assert payload.related_item.slug == "getting-started"


@pytest.mark.asyncio
async def test_process_webhook_ignores_non_page_events(monkeypatch):
    calls = []

    async def fake_ingest(page_id: int):
        calls.append(("ingest", page_id))

    async def fake_delete(page_id: int):
        calls.append(("delete", page_id))

    monkeypatch.setattr(
        "app.api.router_webhook.ingestion_service.ingest_single_page",
        fake_ingest,
    )
    monkeypatch.setattr(
        "app.api.router_webhook.ingestion_service.delete_page",
        fake_delete,
    )

    payload = BookStackWebhookPayload.model_construct(
        event="book_update",
        related_item=type(
            "Related",
            (),
            {"id": 99, "name": "Docs Book", "slug": "docs-book"},
        )(),
    )

    await _process_webhook(payload)

    assert calls == []
