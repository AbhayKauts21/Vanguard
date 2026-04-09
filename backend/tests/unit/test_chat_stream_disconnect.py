from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api import router_chat, router_chats
from app.domain.schemas import ChatMessageCreateRequest, ChatRequest, ChatResponse
from app.services.chat_service import PreparedVoiceTurn


class FakeDisconnectingRequest:
    def __init__(self, *states: bool):
        self._states = list(states)
        self.headers = {}
        self.state = SimpleNamespace(request_id="test-request")

    async def is_disconnected(self) -> bool:
        if self._states:
            return self._states.pop(0)
        return True


async def collect_streaming_response_body(response) -> str:
    chunks: list[str] = []
    async for chunk in response.body_iterator:
        if isinstance(chunk, bytes):
            chunks.append(chunk.decode())
        else:
            chunks.append(str(chunk))
    return "".join(chunks)


@pytest.mark.asyncio
async def test_guest_chat_stream_stops_emitting_when_client_disconnects_before_voice_events(
    monkeypatch,
):
    prepared_calls: list[str] = []

    async def fake_prepare_voice_turn(*, question, history, locale="en", user_id=None):
        prepared_calls.append(question)
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
        router_chat.chat_service,
        "prepare_voice_turn",
        fake_prepare_voice_turn,
    )

    request = FakeDisconnectingRequest(False, True)
    chat_stream = getattr(router_chat.chat_stream, "__wrapped__", router_chat.chat_stream)
    response = await chat_stream(
        request,
        ChatRequest(message="How do I reset my password?", voice_mode=True),
    )

    body = await collect_streaming_response_body(response)

    assert prepared_calls == ["How do I reset my password?"]
    assert body == ""


@pytest.mark.asyncio
async def test_authenticated_chat_stream_stops_emitting_when_client_disconnects_before_yield(
    monkeypatch,
):
    stream_calls: list[str] = []

    async def fake_stream_message(session, *, current_user, chat_id, payload, locale="en"):
        stream_calls.append(payload.message)
        yield {"type": "token", "content": "Full answer."}
        yield {
            "type": "done",
            "primary_citations": [],
            "secondary_citations": [],
            "all_citations": [],
            "hidden_sources_count": 0,
            "mode_used": "rag",
            "max_confidence": 0.0,
        }

    monkeypatch.setattr(
        router_chats.chat_service,
        "stream_message",
        fake_stream_message,
    )

    request = FakeDisconnectingRequest(False, True)
    stream_message = getattr(
        router_chats.stream_message,
        "__wrapped__",
        router_chats.stream_message,
    )
    response = await stream_message(
        request,
        uuid4(),
        ChatMessageCreateRequest(message="How do I reset my password?"),
        current_user=SimpleNamespace(id=uuid4()),
        session=object(),
    )

    body = await collect_streaming_response_body(response)

    assert stream_calls == ["How do I reset my password?"]
    assert body == ""
