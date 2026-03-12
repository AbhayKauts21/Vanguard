from pydantic import BaseModel
from typing import List, Optional

class Citation(BaseModel):
    source: str
    content: str
    url: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
