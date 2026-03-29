from __future__ import annotations
from typing import List
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog as AuditLogModel
from app.domain.audit_log import AuditLogCreate

class AuditRepository:
    async def create(self, session: AsyncSession, log_in: AuditLogCreate) -> AuditLogModel:
        db_log = AuditLogModel(
            event_code=log_in.event_code,
            actor_id=log_in.actor_id,
            resource_type=log_in.resource_type,
            resource_id=log_in.resource_id,
            description=log_in.description,
            context=log_in.context,
            status=log_in.status
        )
        session.add(db_log)
        await session.flush()
        await session.refresh(db_log)
        return db_log

    async def list_recent(self, session: AsyncSession, limit: int = 50) -> List[AuditLogModel]:
        query = select(AuditLogModel).order_by(desc(AuditLogModel.timestamp)).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())

audit_repository = AuditRepository()
