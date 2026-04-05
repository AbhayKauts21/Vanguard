from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.router_azure_chat import router as azure_chat_router
from app.core.exceptions import AzureOpenAITimeoutError, cleo_exception_handler
from app.domain.schemas import AzureChatResponse, ChatResponse


def test_azure_chat_route_returns_sync_response(monkeypatch):
    app = FastAPI()
    from app.core.exceptions import CleoError

    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.include_router(azure_chat_router, prefix="/api/v1")

    async def fake_create_chat(request):
        return AzureChatResponse(
            conversation_id=request.conversation_id,
            output_text="generated response",
            deployment="chat-prod",
            request_id="req-1",
        )

    monkeypatch.setattr(
        "app.api.router_azure_chat.azure_chat_service.create_chat",
        fake_create_chat,
    )

    client = TestClient(app)
    response = client.post(
        "/api/v1/azure-chat/",
        json={
            "conversation_id": "conv-123",
            "prompt": "Help me summarize this",
            "input_text": "Some text",
            "context": {"source": "ticket"},
        },
    )

    assert response.status_code == 200
    assert response.json()["output_text"] == "generated response"
    assert response.json()["conversation_id"] == "conv-123"


def test_azure_chat_route_returns_422_for_invalid_payload():
    app = FastAPI()
    from app.core.exceptions import CleoError

    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.include_router(azure_chat_router, prefix="/api/v1")
    client = TestClient(app)

    response = client.post("/api/v1/azure-chat/", json={"context": {}})

    assert response.status_code == 422


def test_azure_chat_route_maps_timeout_error(monkeypatch):
    app = FastAPI()
    from app.core.exceptions import CleoError

    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.include_router(azure_chat_router, prefix="/api/v1")

    async def failing_create_chat(request):
        raise AzureOpenAITimeoutError("timed out")

    monkeypatch.setattr(
        "app.api.router_azure_chat.azure_chat_service.create_chat",
        failing_create_chat,
    )

    client = TestClient(app)
    response = client.post(
        "/api/v1/azure-chat/",
        json={"prompt": "Hello", "context": {}},
    )

    assert response.status_code == 504
    assert response.json()["title"] == "AzureOpenAITimeoutError"
    assert response.json()["detail"] == "timed out"


def test_direct_azure_route_does_not_break_existing_chat(monkeypatch):
    import main
    from app.core.exceptions import CleoError

    async def fake_create_chat(request):
        return AzureChatResponse(
            conversation_id=request.conversation_id,
            output_text="direct azure output",
            deployment="chat-prod",
        )

    async def fake_answer_query(message, history=None, locale="en", user_id=None):
        return ChatResponse(
            answer="rag response",
            primary_citations=[],
            secondary_citations=[],
            all_citations=[],
            hidden_sources_count=0,
            mode_used="rag",
            max_confidence=0.0,
            conversation_id=None,
        )

    monkeypatch.setattr(main, "start_scheduler", lambda: None)
    monkeypatch.setattr(main, "stop_scheduler", lambda: None)
    monkeypatch.setattr(
        "app.api.router_azure_chat.azure_chat_service.create_chat",
        fake_create_chat,
    )
    monkeypatch.setattr(
        "app.api.router_chat.rag_service.answer_query",
        fake_answer_query,
    )

    app = main.get_application()
    app.add_exception_handler(CleoError, cleo_exception_handler)

    with TestClient(app) as client:
        azure_response = client.post(
            "/api/v1/azure-chat/",
            json={"prompt": "Hello", "context": {}},
        )
        rag_response = client.post(
            "/api/v1/chat/",
            json={"message": "How do I reset my password?"},
        )

    assert azure_response.status_code == 200
    assert azure_response.json()["output_text"] == "direct azure output"
    assert rag_response.status_code == 200
    assert rag_response.json()["answer"] == "rag response"
