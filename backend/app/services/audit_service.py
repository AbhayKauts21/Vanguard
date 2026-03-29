from __future__ import annotations
import asyncio
import json
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.audit_log import AuditEventCode, AuditLog, AuditLogCreate
from app.repositories.audit_repository import audit_repository

class AuditService:
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue):
        self._subscribers.discard(queue)

    def logger(self, actor_id: Optional[UUID] = None) -> AuditLogger:
        return AuditLogger(self, actor_id)

    async def _broadcast(self, log: AuditLog):
        if not self._subscribers:
            return
            
        data = json.dumps({
            "id": str(log.id),
            "event_code": int(log.event_code),
            "timestamp": log.timestamp.isoformat(),
            "description": log.description,
            "status": log.status,
            "context": log.context
        })
        
        # Dispatch to all active SSE subscribers
        tasks = [queue.put(data) for queue in self._subscribers]
        if tasks:
            await asyncio.gather(*tasks)

    async def get_recent_logs(self, session: AsyncSession, limit: int = 50) -> List[AuditLog]:
        db_logs = await audit_repository.list_recent(session, limit)
        return [AuditLog.model_validate(log) for log in db_logs]

class AuditLogger:
    def __init__(self, service: AuditService, actor_id: Optional[UUID] = None):
        self.service = service
        self._actor_id = actor_id
        self._event_code: Optional[AuditEventCode] = None
        self._resource_type: Optional[str] = None
        self._resource_id: Optional[str] = None
        self._description: str = ""
        self._context: Dict[str, Any] = {}
        self._status: str = "SUCCESS"

    def event(self, code: AuditEventCode):
        self._event_code = code
        return self

    def resource(self, type: str, id: Any):
        self._resource_type = type
        self._resource_id = str(id)
        return self

    def desc(self, description: str):
        self._description = description
        return self

    def context(self, **kwargs):
        self._context.update(kwargs)
        return self

    def failed(self):
        self._status = "FAILURE"
        return self

    async def commit(self, session: AsyncSession) -> AuditLog:
        if not self._event_code:
            raise ValueError("Audit event code must be specified")
            
        log_in = AuditLogCreate(
            event_code=self._event_code,
            actor_id=self._actor_id,
            resource_type=self._resource_type,
            resource_id=self._resource_id,
            description=self._description,
            context=self._context,
            status=self._status
        )
        
        db_log = await audit_repository.create(session, log_in)
        domain_log = AuditLog.model_validate(db_log)
        
        # Broadcast for real-time feed
        await self.service._broadcast(domain_log)
        
        return domain_log

audit_service = AuditService()
