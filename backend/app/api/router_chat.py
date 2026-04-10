"""Chat router — RAG-powered conversational endpoint.

Phase 7: rate-limited. Phase 8: structured request logging.
"""

import json
import time
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging import get_request_logger
from app.domain.schemas import ChatRequest, ChatResponse
from app.core.exceptions import NoContextFoundError
from app.core.prompts import NO_CONTEXT_RESPONSE
from app.services.rag_service import rag_service
from app.services.chat_service import chat_service

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

_rate = f"{settings.RATE_LIMIT_PER_MINUTE}/minute"


@router.post("/", response_model=ChatResponse)
@limiter.limit(_rate)
async def chat(request: Request, body: ChatRequest):
    """Handle user query via the RAG pipeline. Returns answer + citations."""
    rlog = get_request_logger(request)
    rlog.info("request.received", endpoint="/chat", method="POST", query_length=len(body.message))
    t0 = time.perf_counter()
    locale = request.headers.get("Accept-Language", "en")[:2]
    history = body.conversation_history[-body.max_history:] if body.conversation_history else None

    response = await rag_service.answer_query(
        body.message,
        history=history,
        locale=locale,
    )
    response.conversation_id = body.conversation_id
    if body.voice_mode:
        await chat_service.build_voice_response(
            question=body.message,
            history=list(history or []),
            locale=locale,
            response=response,
        )

    rlog.info("request.completed", endpoint="/chat", status=200, duration_ms=round((time.perf_counter() - t0) * 1000, 1))
    return response


@router.post("/stream")
@limiter.limit(_rate)
async def chat_stream(request: Request, body: ChatRequest):
    """Streaming chat — SSE with token-by-token delivery + final citations mapping."""
    rlog = get_request_logger(request)
    rlog.info("request.received", endpoint="/chat/stream", method="POST", query_length=len(body.message))
    locale = request.headers.get("Accept-Language", "en")[:2]
    history = body.conversation_history[-body.max_history:] if body.conversation_history else None

    async def event_stream():
        buffered_tokens: list[str] = []
        final_event: dict | None = None
        try:
            if await request.is_disconnected():
                return

            if body.voice_mode:
                prepared = await chat_service.prepare_voice_turn(
                    question=body.message,
                    history=list(history or []),
                    locale=locale,
                    user_id=None,
                )
                if await request.is_disconnected():
                    return
                yield f"data: {json.dumps(chat_service.build_voice_ready_event(prepared))}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'content': prepared.response.answer})}\n\n"
                yield f"data: {json.dumps(chat_service.build_stream_done_event(prepared.response))}\n\n"
                return

            async for chunk in rag_service.answer_query_stream(
                body.message,
                history=history,
                locale=locale,
            ):
                if await request.is_disconnected():
                    return
                if chunk.get("type") == "token":
                    buffered_tokens.append(str(chunk.get("content", "")))
                    yield f"data: {json.dumps(chunk)}\n\n"
                elif chunk.get("type") == "done":
                    final_event = chunk
        except NoContextFoundError:
            # Graceful decline as SSE if knowledge base is totally empty (E-002)
            buffered_tokens.append(NO_CONTEXT_RESPONSE)
            yield f"data: {json.dumps({'type': 'token', 'content': NO_CONTEXT_RESPONSE})}\n\n"
            final_event = {'type': 'done', 'primary_citations': [], 'secondary_citations': [], 'all_citations': [], 'hidden_sources_count': 0, 'mode_used': 'rag', 'max_confidence': 0.0}
        except Exception as exc:
            rlog.exception("request.stream_failed", endpoint="/chat/stream", error=str(exc))
            error_message = "I ran into a temporary response issue. Please try again."
            buffered_tokens.append(error_message)
            yield f"data: {json.dumps({'type': 'token', 'content': error_message})}\n\n"
            final_event = {'type': 'done', 'primary_citations': [], 'secondary_citations': [], 'all_citations': [], 'hidden_sources_count': 0, 'mode_used': 'rag', 'max_confidence': 0.0}

        if final_event is None:
            return

        if await request.is_disconnected():
            return

        yield f"data: {json.dumps(final_event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
