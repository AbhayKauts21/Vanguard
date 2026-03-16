"""Webhook router — receives real-time events from BookStack."""

from fastapi import APIRouter, BackgroundTasks, Request
from loguru import logger

from app.domain.schemas import BookStackWebhookPayload, WebhookEvent
from app.services.ingestion_service import ingestion_service

router = APIRouter(
    prefix="/webhook",
    tags=["webhook"],
)


async def _process_webhook(payload: BookStackWebhookPayload) -> None:
    """Background task: process the webhook event asynchronously."""
    event = payload.event
    related = payload.related_item

    if not related or related.type != "page":
        logger.debug(f"Ignoring non-page webhook event: {event}")
        return

    page_id = related.id

    if event in (WebhookEvent.PAGE_CREATE, WebhookEvent.PAGE_UPDATE):
        logger.info(f"Webhook: {event} → ingesting page {page_id}")
        try:
            await ingestion_service.ingest_single_page(page_id)
        except Exception as e:
            logger.error(f"Webhook ingestion failed for page {page_id}: {e}")

    elif event == WebhookEvent.PAGE_DELETE:
        logger.info(f"Webhook: page_delete → removing page {page_id}")
        try:
            await ingestion_service.delete_page(page_id)
        except Exception as e:
            logger.error(f"Webhook deletion failed for page {page_id}: {e}")

    else:
        logger.debug(f"Ignoring unhandled webhook event: {event}")


@router.post("/bookstack")
async def receive_bookstack_webhook(
    payload: BookStackWebhookPayload,
    background_tasks: BackgroundTasks,
):
    """
    Receives BookStack webhook POST.
    Processes ingestion/deletion asynchronously to return 200 fast.
    """
    logger.info(f"Webhook received: {payload.event}")
    background_tasks.add_task(_process_webhook, payload)
    return {"status": "accepted", "event": payload.event}
