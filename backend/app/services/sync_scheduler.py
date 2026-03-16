"""Sync scheduler — polls BookStack for changes on a fixed interval."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from app.core.config import settings


# Module-level scheduler instance
_scheduler: AsyncIOScheduler | None = None


async def _run_delta_sync() -> None:
    """Job callback: runs incremental sync from BookStack → Pinecone."""
    # Import here to avoid circular dependency
    from app.services.ingestion_service import ingestion_service

    try:
        processed = await ingestion_service.delta_sync()
        logger.info(f"Scheduled sync complete: {processed} pages updated")
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")


def start_scheduler() -> None:
    """Start the background polling scheduler (called on FastAPI startup)."""
    global _scheduler

    if _scheduler is not None:
        logger.warning("Scheduler already running")
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
