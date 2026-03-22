"""Admin router — ingestion management endpoints.

Phase 7: all routes require ``X-API-Key`` header matching
``ADMIN_API_KEY`` env var.
"""

from fastapi import APIRouter, BackgroundTasks, Depends
from loguru import logger

from app.core.auth import verify_admin_key
from app.domain.schemas import (
    FullSyncResult,
    IngestionResult,
    SyncStatusResponse,
)
from app.services.ingestion_service import ingestion_service
from app.services.sync_scheduler import get_next_run_time

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(verify_admin_key)],
)


@router.post("/ingest", response_model=FullSyncResult)
async def trigger_full_sync():
    """Trigger a full re-sync of all BookStack pages → Pinecone."""
    logger.info("Admin: full sync triggered")
    result = await ingestion_service.full_sync()
    return result


@router.post("/ingest/{page_id}", response_model=IngestionResult)
async def trigger_page_sync(page_id: int):
    """Re-ingest a single BookStack page by ID."""
    logger.info(f"Admin: single page sync for {page_id}")
    result = await ingestion_service.ingest_single_page(page_id)
    return result


@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status():
    """Return current sync status and schedule info."""
    status = ingestion_service.get_status()
    status.next_sync_at = get_next_run_time()
    return status
