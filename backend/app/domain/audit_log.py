from enum import IntEnum
from pydantic import BaseModel, ConfigDict
from typing import Any, Dict, Optional
from uuid import UUID
from datetime import datetime

class AuditEventCode(IntEnum):
    # Identity & Access (1xxx)
    USER_LOGGED_IN = 1001
    USER_LOGGED_OUT = 1002
    USER_ROLES_UPDATED = 1004
    PASSWORD_RESET_REQUESTED = 1005

    # Documents & Knowledge (2xxx)
    DOC_UPLOADED = 2001
    DOC_DELETED = 2002
    DOC_REINDEXED = 2003
    DOC_PROCESSING_FAILED = 2004
    DOC_READY = 2005

    # Conversations & Chat (3xxx)
    CHAT_STARTED = 3001
    CHAT_DELETED = 3002
    CHAT_TITLED = 3003

    # System & Sourcing (4xxx)
    SYNC_TRIGGERED = 4001
    SYNC_COMPLETED = 4002
    SYNC_FAILED = 4003
    SYNC_SCOPE_UPDATED = 4004

    # Security & Errors (9xxx)
    UNAUTHORIZED_ACCESS_ATTEMPT = 9001
    SYSTEM_ERROR_CRITICAL = 9002

class AuditLogCreate(BaseModel):
    event_code: AuditEventCode
    actor_id: Optional[UUID] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: str
    context: Dict[str, Any] = {}
    status: str = "SUCCESS"

class AuditLog(AuditLogCreate):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    timestamp: datetime
