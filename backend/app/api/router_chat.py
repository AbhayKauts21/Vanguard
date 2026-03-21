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
    response = await rag_service.answer_query(request.message)
    response.conversation_id = request.conversation_id
    return response


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat — SSE with token-by-token delivery + final citations."""
    logger.info(f"Streaming query: '{request.message[:80]}...'")

    try:
        token_stream, ranked_citations = await rag_service.answer_query_stream(request.message)
    except NoContextFoundError:
        # Return graceful decline as SSE
        async def no_context_stream():
            yield f"data: {json.dumps({'type': 'token', 'content': NO_CONTEXT_RESPONSE})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'primary_citations': [], 'secondary_citations': [], 'all_citations': [], 'hidden_sources_count': 0})}\n\n"
        return StreamingResponse(no_context_stream(), media_type="text/event-stream")

    async def event_stream():
        """Yields SSE events: tokens first, then citations at the end."""
        async for token in token_stream:
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # Send citations as final event
        yield f"data: {json.dumps({
            'type': 'done', 
            'primary_citations': [c.model_dump() for c in ranked_citations['primary']],
            'secondary_citations': [c.model_dump() for c in ranked_citations['secondary']],
            'all_citations': [c.model_dump() for c in ranked_citations['all_sources']],
            'hidden_sources_count': ranked_citations['hidden_count']
        })}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
