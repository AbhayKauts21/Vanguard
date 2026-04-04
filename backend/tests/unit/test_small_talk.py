import pytest
from app.services.rag_service import RAGService
from app.domain.schemas import ChatResponse, ConversationMessage

@pytest.mark.parametrize("query,expected", [
    ("Hi", True),
    ("Hello Cleo", True),
    ("How are you?", True),
    ("What is your name?", True),
    ("Thanks!", True),
    ("Who created you?", True),
    ("What is SSO?", False),
    ("How do I reset my password?", False),
])
def test_is_small_talk(query, expected):
    service = RAGService()
    assert service._is_small_talk(query) == expected

@pytest.mark.asyncio
async def test_small_talk_routes_to_llm_without_context(monkeypatch):
    service = RAGService()
    
    captured = {}
    async def fake_generate(question, context_chunks, **kwargs):
        captured["question"] = question
        captured["context_chunks"] = context_chunks
        return "Hello! I am CLEO."

    monkeypatch.setattr(service.llm_client, "generate", fake_generate)
    
    response = await service.answer_query("Hello")
    
    assert response.answer == "Hello! I am CLEO."
    assert response.max_confidence == 1.0
    assert response.mode_used == "rag"
    assert captured["context_chunks"] == []
