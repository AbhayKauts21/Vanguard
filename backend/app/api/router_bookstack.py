from fastapi import APIRouter, Depends

from app.api.deps import require_permissions
from app.domain.schemas import (
    BookStackSyncConfigRequest,
    BookStackSyncConfigResponse,
    BookStackTreeResponse,
)
from app.services.bookstack_sync_config_service import bookstack_sync_config_service

router = APIRouter(
    prefix="/bookstack",
    tags=["bookstack"],
    dependencies=[Depends(require_permissions("sync:manage"))],
)


@router.get("/tree", response_model=BookStackTreeResponse)
async def get_bookstack_tree():
    return await bookstack_sync_config_service.get_tree()


@router.get("/sync-config", response_model=BookStackSyncConfigResponse)
async def get_bookstack_sync_config():
    return await bookstack_sync_config_service.get_config()


@router.post("/sync-config", response_model=BookStackSyncConfigResponse)
async def save_bookstack_sync_config(body: BookStackSyncConfigRequest):
    return await bookstack_sync_config_service.save_config(body)
