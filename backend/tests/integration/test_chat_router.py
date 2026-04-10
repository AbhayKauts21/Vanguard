import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.router_chat import router as chat_router
from app.core.exceptions import CleoError, cleo_exception_handler
from app.domain.schemas import ChatResponse
from app.services.chat_service import PreparedVoiceTurn


def build_app():
    app = FastAPI()
    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.include_router(chat_router, prefix="/api/v1")
    return app


def test_chat_route_includes_voice_response_when_voice_mode_enabled(monkeypatch):
    async def fake_answer_query(message, history=None, locale="en", user_id=None):
        return ChatResponse(
            answer="Full grounded answer.",
            primary_citations=[],
            secondary_citations=[],
            all_citations=[],
            hidden_sources_count=0,
            mode_used="rag",
            max_confidence=0.93,
        )

    async def fake_build_voice_response(*, question, history, locale, response):
        response.voice_response = "Short spoken answer."
        return response.voice_response

    monkeypatch.setattr("app.api.router_chat.rag_service.answer_query", fake_answer_query)
    monkeypatch.setattr(
        "app.api.router_chat.chat_service.build_voice_response",
        fake_build_voice_response,
    )

    client = TestClient(build_app())
    response = client.post(
        "/api/v1/chat/",
        json={"message": "How do I reset my password?", "voice_mode": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Full grounded answer."
    assert payload["voice_response"] == "Short spoken answer."


def test_chat_stream_emits_voice_ready_before_text_for_voice_mode(monkeypatch):
    async def fake_prepare_voice_turn(*, question, history, locale="en", user_id=None):
        return PreparedVoiceTurn(
            response=ChatResponse(
                answer="Full answer.",
                primary_citations=[],
                secondary_citations=[],
                all_citations=[],
                hidden_sources_count=0,
                mode_used="rag",
                max_confidence=0.91,
                voice_response="Short spoken answer.",
            ),
            voice_audio_bytes=b"audio",
            voice_audio_content_type="audio/mpeg",
        )

    monkeypatch.setattr(
        "app.api.router_chat.chat_service.prepare_voice_turn",
        fake_prepare_voice_turn,
    )

    client = TestClient(build_app())
    response = client.post(
        "/api/v1/chat/stream",
        json={"message": "How do I reset my password?", "voice_mode": True},
    )

    assert response.status_code == 200

    events = []
    for line in response.text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))

    assert events[0] == {
        "type": "voice_ready",
        "voice_response": "Short spoken answer.",
        "voice_audio_base64": "YXVkaW8=",
        "voice_audio_content_type": "audio/mpeg",
    }
    assert events[1] == {"type": "token", "content": "Full answer."}
    assert events[-1]["voice_response"] == "Short spoken answer."
