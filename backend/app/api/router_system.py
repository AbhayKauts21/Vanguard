from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.api.deps import get_db_session, require_permissions
from app.services.audit_service import audit_service
from app.domain.audit_log import AuditLog

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/events")
async def audit_events_stream():
    """
    Server-Sent Events endpoint for real-time audit logs.
    """
    async def event_generator():
        queue = await audit_service.subscribe()
        try:
            while True:
                # Wait for new events from the service
                data = await queue.get()
                yield {
                    "event": "audit_log",
                    "id": None,
                    "retry": 15000,
                    "data": data
                }
        finally:
            await audit_service.unsubscribe(queue)

    return EventSourceResponse(event_generator())

@router.get("/logs", response_model=List[AuditLog])
async def get_audit_logs(
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session),
    _ = Depends(require_permissions("system.view_audit_logs"))
):
    """
    Fetch historical audit logs.
    """
    return await audit_service.get_recent_logs(session, limit)
