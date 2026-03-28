import json
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import require_permissions
from app.core.config import settings
from app.core.logging import get_request_logger
from app.db.models import User
from app.db.session import get_db_session
from app.domain.schemas import (
    ChatCreateRequest,
    ChatListResponse,
    ChatMessageCreateRequest,
    ChatMessagesResponse,
    ChatSendResponse,
    ChatSummaryResponse,
)
from app.services.chat_service import chat_service

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/chats", tags=["chats"])
_rate = f"{settings.RATE_LIMIT_PER_MINUTE}/minute"


@router.post(
    "/",
    response_model=ChatSummaryResponse,
    status_code=201,
)
async def create_chat(
    body: ChatCreateRequest | None = None,
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    return await chat_service.create_chat(session, current_user=current_user, payload=body)


@router.get(
    "/",
    response_model=ChatListResponse,
)
async def list_chats(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    return await chat_service.list_chats(session, current_user=current_user, limit=limit)


@router.get(
    "/{chat_id}/messages",
    response_model=ChatMessagesResponse,
)
async def get_chat_messages(
    chat_id: UUID,
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    return await chat_service.get_chat_messages(session, current_user=current_user, chat_id=chat_id)


@router.post(
    "/{chat_id}/messages",
    response_model=ChatSendResponse,
)
@limiter.limit(_rate)
async def send_message(
    request: Request,
    chat_id: UUID,
    body: ChatMessageCreateRequest,
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    rlog = get_request_logger(request)
    rlog.info("chat.send.received", chat_id=str(chat_id), query_length=len(body.message))
    response = await chat_service.send_message(
        session,
        current_user=current_user,
        chat_id=chat_id,
        payload=body,
    )
    rlog.info("chat.send.completed", chat_id=str(chat_id), status=200)
    return response


@router.post(
    "/{chat_id}/messages/stream",
)
@limiter.limit(_rate)
async def stream_message(
    request: Request,
    chat_id: UUID,
    body: ChatMessageCreateRequest,
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    rlog = get_request_logger(request)
    rlog.info("chat.stream.received", chat_id=str(chat_id), query_length=len(body.message))

    async def event_stream():
        try:
            async for event in chat_service.stream_message(
                session,
                current_user=current_user,
                chat_id=chat_id,
                payload=body,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            rlog.exception("chat.stream.failed", chat_id=str(chat_id), error=str(exc))
            yield f"data: {json.dumps({'type': 'token', 'content': 'I ran into a temporary response issue. Please try again.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'primary_citations': [], 'secondary_citations': [], 'all_citations': [], 'hidden_sources_count': 0, 'mode_used': 'rag', 'max_confidence': 0.0})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.delete(
    "/{chat_id}",
    status_code=204,
)
async def delete_chat(
    chat_id: UUID,
    current_user: User = Depends(require_permissions("chat:use")),
    session: AsyncSession = Depends(get_db_session),
):
    await chat_service.delete_chat(session, current_user=current_user, chat_id=chat_id)
