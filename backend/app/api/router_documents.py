from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permissions
from app.db.models import User
from app.db.session import get_db_session
from app.domain.schemas import UploadedDocumentListResponse, UploadedDocumentResponse
from app.services.document_upload_service import document_upload_service


router = APIRouter(prefix="/documents", tags=["documents"])


def _parse_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


@router.post("/upload", response_model=UploadedDocumentResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    tags: str | None = Form(default=None),
    user_id: UUID | None = Form(default=None),
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    return await document_upload_service.upload_document(
        session,
        current_user=current_user,
        file=file,
        background_tasks=background_tasks,
        title=title,
        tags=_parse_tags(tags),
        requested_user_id=user_id,
    )


@router.get("/", response_model=UploadedDocumentListResponse)
async def list_documents(
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    items = await document_upload_service.list_documents_for_user(
        session,
        current_user=current_user,
    )
    return UploadedDocumentListResponse(items=items)
