"""Webhook router — receives real-time events from BookStack.

Phase 7: validates HMAC-SHA256 signature via X-BookStack-Signature
header before accepting any event.
"""

import json

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from loguru import logger

from app.core.config import settings
from app.core.security import verify_webhook_signature
from app.domain.schemas import BookStackWebhookPayload, WebhookEvent
from app.services.document_sync_service import document_sync_service

router = APIRouter(
    prefix="/webhook",
    tags=["webhook"],
)


async def _process_webhook(payload: BookStackWebhookPayload) -> None:
    """Background task: process the webhook event asynchronously."""
    event = payload.event
    related = payload.related_item

    if not related:
        logger.debug(f"Ignoring webhook event with no related_item: {event}")
        return

    # Event name prefix tells us the entity type (page_create → page)
    if not event.startswith("page_"):
        logger.debug(f"Ignoring non-page webhook event: {event}")
        return

    page_id = related.id

    if event in (WebhookEvent.PAGE_CREATE, WebhookEvent.PAGE_UPDATE):
        logger.info(f"Webhook: {event} → ingesting page {page_id}")
        try:
            await document_sync_service.sync_document(
                source_key=settings.BOOKSTACK_SOURCE_KEY,
                external_document_id=str(page_id),
                trigger="webhook",
            )
        except Exception as e:
            logger.error(f"Webhook ingestion failed for page {page_id}: {e}")

    elif event == WebhookEvent.PAGE_DELETE:
        logger.info(f"Webhook: page_delete → removing page {page_id}")
        try:
            await document_sync_service.delete_document(
                source_key=settings.BOOKSTACK_SOURCE_KEY,
                external_document_id=str(page_id),
                trigger="webhook",
            )
        except Exception as e:
            logger.error(f"Webhook deletion failed for page {page_id}: {e}")

    else:
        logger.debug(f"Ignoring unhandled webhook event: {event}")


@router.post("/bookstack")
async def receive_bookstack_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receives BookStack webhook POST.

    1. Reads the raw body and verifies the HMAC-SHA256 signature.
    2. Parses the validated body into a BookStackWebhookPayload.
    3. Processes ingestion/deletion asynchronously to return 200 fast.
    """
    body = await request.body()
    signature = request.headers.get("X-BookStack-Signature", "")

    if not verify_webhook_signature(body, signature, settings.BOOKSTACK_WEBHOOK_SECRET):
        logger.warning("Webhook rejected: invalid HMAC signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature.",
        )

    payload = BookStackWebhookPayload(**json.loads(body))
    logger.info(f"Webhook received (verified): {payload.event}")
    background_tasks.add_task(_process_webhook, payload)
    return {"status": "accepted", "event": payload.event}
