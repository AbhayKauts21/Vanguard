from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.domain.schemas import (
    ChatMessageCreateRequest,
    ChatResponse,
    ChatSummaryResponse,
    ConversationMessage,
)
from app.services.chat_service import ChatService


class FakeSession:
    async def commit(self):
        return None


class FakeRAGService:
    async def answer_query(self, question, history=None, locale="en", user_id=None):
        return ChatResponse(
            answer="Full grounded answer with **markdown**.",
            primary_citations=[],
            secondary_citations=[],
            all_citations=[],
            hidden_sources_count=0,
            mode_used="rag",
            max_confidence=0.88,
        )


class FakeVoiceConversationService:
    def __init__(self):
        self.calls = []

    async def create_voice_response(self, **kwargs):
        self.calls.append(kwargs)
        return "Short spoken reply."


class FakeTTSService:
    def __init__(self):
        self.calls = []

    def content_type(self) -> str:
        return "audio/mpeg"

    async def synthesize(self, **kwargs):
        self.calls.append(kwargs)
        return b"voice-audio"


def build_message_record(*, chat_id, sender, content, metadata=None):
    return SimpleNamespace(
        id=uuid4(),
        chat_id=chat_id,
        sender=sender,
        content=content,
        created_at=datetime.now(timezone.utc),
        metadata_json=metadata or {},
    )


def build_summary(chat_id):
    now = datetime.now(timezone.utc)
    return ChatSummaryResponse(
        id=chat_id,
        title="Password reset",
        created_at=now,
        updated_at=now,
        message_count=2,
        last_message_preview="Full grounded answer with **markdown**.",
    )


@pytest.mark.asyncio
async def test_send_message_returns_voice_response_without_persisting_it(monkeypatch):
    user_id = uuid4()
    chat_id = uuid4()
    current_user = SimpleNamespace(id=user_id)
    chat = SimpleNamespace(id=chat_id, user_id=user_id, title="Existing title")
    created_messages = []

    async def fake_create_message(session, *, chat_id, sender, content, metadata=None):
        created_messages.append(
            {
                "chat_id": chat_id,
                "sender": sender,
                "content": content,
                "metadata": metadata or {},
            }
        )
        return build_message_record(
            chat_id=chat_id,
            sender=sender,
            content=content,
            metadata=metadata,
        )

    async def fake_touch_chat(session, *, chat, when):
        return None

    voice_service = FakeVoiceConversationService()
    tts_service = FakeTTSService()
    service = ChatService(
        rag_service=FakeRAGService(),
        voice_conversation_service=voice_service,
        tts_service=tts_service,
    )

    async def fake_get_owned_chat(session, *, current_user, chat_id):
        return chat

    async def fake_build_history(session, *, chat_id):
        return [ConversationMessage(role="user", content="I forgot my password.")]

    async def fake_ensure_chat_title(session, *, chat, first_user_message):
        return None

    async def fake_build_chat_summary_after_send(session, *, chat_id, user_id):
        return build_summary(chat_id)

    monkeypatch.setattr(
        "app.services.chat_service.chat_repository.create_message",
        fake_create_message,
    )
    monkeypatch.setattr(
        "app.services.chat_service.chat_repository.touch_chat",
        fake_touch_chat,
    )
    monkeypatch.setattr(service, "_get_owned_chat", fake_get_owned_chat)
    monkeypatch.setattr(service, "_build_history", fake_build_history)
    monkeypatch.setattr(service, "_ensure_chat_title", fake_ensure_chat_title)
    monkeypatch.setattr(
        service,
        "_build_chat_summary_after_send",
        fake_build_chat_summary_after_send,
    )

    response = await service.send_message(
        FakeSession(),
        current_user=current_user,
        chat_id=chat_id,
        payload=ChatMessageCreateRequest(
            message="How do I reset my password?",
            voice_mode=True,
        ),
        locale="en",
    )

    assert response.assistant_message.content == "Full grounded answer with **markdown**."
    assert response.voice_response == "Short spoken reply."
    assert "voice_response" not in created_messages[-1]["metadata"]
    assert voice_service.calls[0]["answer"] == "Full grounded answer with **markdown**."
    assert voice_service.calls[0]["mode_used"] == "rag"
    assert tts_service.calls == []


@pytest.mark.asyncio
async def test_prepare_voice_turn_returns_rewrite_and_audio(monkeypatch):
    voice_service = FakeVoiceConversationService()
    tts_service = FakeTTSService()
    service = ChatService(
        rag_service=FakeRAGService(),
        voice_conversation_service=voice_service,
        tts_service=tts_service,
    )

    prepared = await service.prepare_voice_turn(
        question="How do I reset my password?",
        history=[ConversationMessage(role="user", content="I forgot my password.")],
        locale="en",
        user_id="user-123",
    )

    assert prepared.response.answer == "Full grounded answer with **markdown**."
    assert prepared.response.voice_response == "Short spoken reply."
    assert prepared.voice_audio_bytes == b"voice-audio"
    assert prepared.voice_audio_content_type == "audio/mpeg"
    assert voice_service.calls[0]["answer"] == "Full grounded answer with **markdown**."
    assert tts_service.calls == [{"text": "Short spoken reply.", "language": "en"}]


@pytest.mark.asyncio
async def test_stream_message_emits_voice_ready_and_persists_full_answer(monkeypatch):
    user_id = uuid4()
    chat_id = uuid4()
    current_user = SimpleNamespace(id=user_id)
    chat = SimpleNamespace(id=chat_id, user_id=user_id, title="Existing title")
    created_messages = []

    async def fake_create_message(session, *, chat_id, sender, content, metadata=None):
        created_messages.append(
            {
                "chat_id": chat_id,
                "sender": sender,
                "content": content,
                "metadata": metadata or {},
            }
        )
        return build_message_record(
            chat_id=chat_id,
            sender=sender,
            content=content,
            metadata=metadata,
        )

    async def fake_touch_chat(session, *, chat, when):
        return None

    voice_service = FakeVoiceConversationService()
    tts_service = FakeTTSService()
    service = ChatService(
        rag_service=FakeRAGService(),
        voice_conversation_service=voice_service,
        tts_service=tts_service,
    )

    async def fake_get_owned_chat(session, *, current_user, chat_id):
        return chat

    async def fake_build_history(session, *, chat_id):
        return [ConversationMessage(role="user", content="I forgot my password.")]

    async def fake_ensure_chat_title(session, *, chat, first_user_message):
        return None

    async def fake_build_chat_summary_after_send(session, *, chat_id, user_id):
        return build_summary(chat_id)

    monkeypatch.setattr(
        "app.services.chat_service.chat_repository.create_message",
        fake_create_message,
    )
    monkeypatch.setattr(
        "app.services.chat_service.chat_repository.touch_chat",
        fake_touch_chat,
    )
    monkeypatch.setattr(service, "_get_owned_chat", fake_get_owned_chat)
    monkeypatch.setattr(service, "_build_history", fake_build_history)
    monkeypatch.setattr(service, "_ensure_chat_title", fake_ensure_chat_title)
    monkeypatch.setattr(
        service,
        "_build_chat_summary_after_send",
        fake_build_chat_summary_after_send,
    )

    events = [
        event
        async for event in service.stream_message(
            FakeSession(),
            current_user=current_user,
            chat_id=chat_id,
            payload=ChatMessageCreateRequest(
                message="How do I reset my password?",
                voice_mode=True,
            ),
            locale="en",
        )
    ]

    assert events[0]["type"] == "voice_ready"
    assert events[0]["voice_response"] == "Short spoken reply."
    assert events[0]["voice_audio_base64"] == "dm9pY2UtYXVkaW8="
    assert events[0]["voice_audio_content_type"] == "audio/mpeg"
    assert events[1] == {"type": "token", "content": "Full grounded answer with **markdown**."}
    assert events[-1]["voice_response"] == "Short spoken reply."
    assert events[-1]["chat_summary"]["id"] == str(chat_id)
    assert created_messages[-1]["content"] == "Full grounded answer with **markdown**."
    assert "voice_response" not in created_messages[-1]["metadata"]
    assert voice_service.calls[0]["answer"] == "Full grounded answer with **markdown**."
    assert tts_service.calls == [{"text": "Short spoken reply.", "language": "en"}]
