"""Sync scheduler — polls BookStack for changes on a fixed interval."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from app.core.config import settings


# Module-level scheduler instance
_scheduler: AsyncIOScheduler | None = None


def _is_bookstack_configured() -> bool:
    """Only run scheduled sync when BookStack connectivity is configured."""
    return all(
        [
            settings.BOOKSTACK_URL,
            settings.BOOKSTACK_TOKEN_ID,
            settings.BOOKSTACK_TOKEN_SECRET,
        ]
    )


async def _run_delta_sync() -> None:
    """Job callback: runs incremental sync from BookStack → Pinecone."""
    if not _is_bookstack_configured():
        logger.info("Skipping scheduled sync because BookStack is not configured")
        return

    # Import here to avoid circular dependency
    from app.services.document_sync_service import document_sync_service

    try:
        processed = await document_sync_service.delta_sync(
            source_key=settings.BOOKSTACK_SOURCE_KEY,
        )
        logger.info(f"Scheduled sync complete: {processed} pages updated")
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")


def start_scheduler() -> None:
    """Start the background polling scheduler (called on FastAPI startup)."""
    global _scheduler

    if _scheduler is not None:
        logger.warning("Scheduler already running")
        return

    if not _is_bookstack_configured():
        logger.info("Auto-sync scheduler not started because BookStack is not configured")
        return

    interval = settings.SYNC_INTERVAL_MINUTES
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _run_delta_sync,
        trigger="interval",
        minutes=interval,
        id="bookstack_delta_sync",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(f"Auto-sync scheduler started: polling every {interval} minutes")


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler (called on FastAPI shutdown)."""
    global _scheduler

    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Auto-sync scheduler stopped")


def get_next_run_time():
    """Return the next scheduled sync time (for status endpoint)."""
    if _scheduler is None:
        return None
    job = _scheduler.get_job("bookstack_delta_sync")
    return job.next_run_time if job else None
