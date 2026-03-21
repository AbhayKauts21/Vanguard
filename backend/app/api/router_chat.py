"""Chat router — RAG-powered conversational endpoint."""

import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from loguru import logger

from app.domain.schemas import ChatRequest, ChatResponse
from app.core.exceptions import NoContextFoundError
from app.core.prompts import NO_CONTEXT_RESPONSE
from app.services.rag_service import rag_service

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle user query via the RAG pipeline. Returns answer + citations."""
    logger.info(f"Chat query: '{request.message[:80]}...'")
    response = await rag_service.answer_query(
        request.message,
        history=request.conversation_history[-request.max_history:] if request.conversation_history else None
    )
    response.conversation_id = request.conversation_id
    return response


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat — SSE with token-by-token delivery + final citations mapping."""
    logger.info(f"Streaming query: '{request.message[:80]}...'")

    async def event_stream():
        try:
            async for chunk in rag_service.answer_query_stream(
                request.message,
                history=request.conversation_history[-request.max_history:] if request.conversation_history else None
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except NoContextFoundError:
            # Graceful decline as SSE if knowledge base is totally empty (E-002)
            yield f"data: {json.dumps({'type': 'token', 'content': NO_CONTEXT_RESPONSE})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'primary_citations': [], 'secondary_citations': [], 'all_citations': [], 'hidden_sources_count': 0, 'mode_used': 'rag', 'max_confidence': 0.0})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
