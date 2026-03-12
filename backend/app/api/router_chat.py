from fastapi import APIRouter
from app.domain.schemas import ChatRequest, ChatResponse

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handle user chat queries via the RAG pipeline.
    """
    # TODO: Implement RAG orchestration
    return ChatResponse(
        answer="I'm Vanguard, your support assistant. I haven't been fully wired yet!",
        citations=[]
    )
