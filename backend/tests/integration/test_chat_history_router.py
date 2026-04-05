from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router_auth import router as auth_router
from app.api.router_chat import router as guest_chat_router
from app.api.router_chats import router as chats_router
from app.core.exceptions import CleoError, cleo_exception_handler, http_exception_handler
from app.db.base import Base
from app.db.models import ChatMessageRecord, ChatSession, Permission, Role
from app.db.session import get_db_session
from app.domain.schemas import ChatResponse, Citation
from app.services.chat_service import chat_service


async def seed_defaults(session: AsyncSession) -> None:
    sync_manage = Permission(code="sync:manage", description="Trigger sync jobs.")
    rbac_manage = Permission(code="rbac:manage", description="Manage RBAC.")
    users_read = Permission(code="users:read", description="Read users.")
    users_manage = Permission(code="users:manage", description="Manage users.")
    chat_use = Permission(code="chat:use", description="Use chat.")

    admin = Role(
        name="admin",
        description="Full platform administration.",
        permissions=[sync_manage, rbac_manage, users_read, users_manage, chat_use],
    )
    operator = Role(
        name="operator",
        description="Operational sync management.",
        permissions=[sync_manage, users_read, chat_use],
    )
    developer = Role(
        name="developer",
        description="Authenticated developer access.",
        permissions=[chat_use],
    )
    viewer = Role(
        name="viewer",
        description="Read-only authenticated access.",
        permissions=[chat_use],
    )

    session.add_all([admin, operator, developer, viewer])
    await session.commit()


class FakeRagService:
    async def answer_query(self, question: str, history=None, locale="en", user_id=None) -> ChatResponse:
        citation = Citation(
            page_id=101,
            page_title="Testing Guide",
            source_url="https://docs.example.com/testing",
            source_type="bookstack",
            source_name="Testing",
            chunk_text="Testing guide chunk",
            score=0.97,
        )
        return ChatResponse(
            answer=f"Answer for: {question}",
            primary_citations=[citation],
            secondary_citations=[],
            all_citations=[citation],
            hidden_sources_count=0,
            mode_used="rag",
            max_confidence=0.97,
            what_i_found=[{"page_title": "Testing Guide", "score": 0.97}],
        )

    async def answer_query_stream(self, question: str, history=None, locale="en", user_id=None):
        yield {"type": "token", "content": "Streamed "}
        yield {"type": "token", "content": f"answer for: {question}"}
        yield {
            "type": "done",
            "primary_citations": [
                {
                    "page_id": 101,
                    "page_title": "Testing Guide",
                    "source_url": "https://docs.example.com/testing",
                    "source_type": "bookstack",
                    "source_name": "Testing",
                    "chunk_text": "Testing guide chunk",
                    "score": 0.97,
                }
            ],
            "secondary_citations": [],
            "all_citations": [
                {
                    "page_id": 101,
                    "page_title": "Testing Guide",
                    "source_url": "https://docs.example.com/testing",
                    "source_type": "bookstack",
                    "source_name": "Testing",
                    "chunk_text": "Testing guide chunk",
                    "score": 0.97,
                }
            ],
            "hidden_sources_count": 0,
            "mode_used": "rag",
            "max_confidence": 0.97,
            "what_i_found": [{"page_title": "Testing Guide", "score": 0.97}],
        }


@pytest_asyncio.fixture
async def chat_test_context(monkeypatch) -> AsyncIterator[dict]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        await seed_defaults(session)

    async def override_get_db_session():
        async with session_factory() as session:
            yield session

    fake_rag = FakeRagService()
    previous_chat_rag = chat_service.rag_service

    app = FastAPI()
    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(chats_router, prefix="/api/v1")
    app.include_router(guest_chat_router, prefix="/api/v1")
    app.dependency_overrides[get_db_session] = override_get_db_session

    monkeypatch.setattr(chat_service, "rag_service", fake_rag)
    monkeypatch.setattr("app.api.router_chat.rag_service", fake_rag)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield {"client": client, "session_factory": session_factory}

    monkeypatch.setattr(chat_service, "rag_service", previous_chat_rag)
    await engine.dispose()


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def register_user(client: httpx.AsyncClient, email: str) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPass123",
            "full_name": email.split("@")[0],
        },
    )
    assert response.status_code == 201
    return response.json()


def parse_sse_events(body: str) -> list[dict]:
    events: list[dict] = []
    for chunk in body.strip().split("\n\n"):
        if not chunk.startswith("data: "):
            continue
        events.append(json.loads(chunk[6:]))
    return events


@pytest.mark.asyncio
async def test_chat_list_is_isolated_per_user(chat_test_context):
    client: httpx.AsyncClient = chat_test_context["client"]

    alice = await register_user(client, "alice@example.com")
    bob = await register_user(client, "bob@example.com")

    create_alice = await client.post(
        "/api/v1/chats/",
        headers=auth_headers(alice["access_token"]),
        json={"title": "Alice chat"},
    )
    create_bob = await client.post(
        "/api/v1/chats/",
        headers=auth_headers(bob["access_token"]),
        json={"title": "Bob chat"},
    )

    assert create_alice.status_code == 201
    assert create_bob.status_code == 201

    alice_list = await client.get("/api/v1/chats/", headers=auth_headers(alice["access_token"]))
    bob_list = await client.get("/api/v1/chats/", headers=auth_headers(bob["access_token"]))

    assert alice_list.status_code == 200
    assert bob_list.status_code == 200
    assert [chat["title"] for chat in alice_list.json()["items"]] == ["Alice chat"]
    assert [chat["title"] for chat in bob_list.json()["items"]] == ["Bob chat"]


@pytest.mark.asyncio
async def test_getting_messages_for_another_users_chat_returns_404(chat_test_context):
    client: httpx.AsyncClient = chat_test_context["client"]

    alice = await register_user(client, "alice2@example.com")
    bob = await register_user(client, "bob2@example.com")

    create_response = await client.post(
        "/api/v1/chats/",
        headers=auth_headers(alice["access_token"]),
    )
    chat_id = create_response.json()["id"]

    forbidden = await client.get(
        f"/api/v1/chats/{chat_id}/messages",
        headers=auth_headers(bob["access_token"]),
    )

    assert forbidden.status_code == 404
    assert forbidden.json()["detail"] == "Chat not found."


@pytest.mark.asyncio
async def test_sending_message_persists_both_messages_and_generates_title(chat_test_context):
    client: httpx.AsyncClient = chat_test_context["client"]
    session_factory = chat_test_context["session_factory"]

    alice = await register_user(client, "alice3@example.com")
    create_response = await client.post(
        "/api/v1/chats/",
        headers=auth_headers(alice["access_token"]),
    )
    chat_id = create_response.json()["id"]

    send_response = await client.post(
        f"/api/v1/chats/{chat_id}/messages",
        headers=auth_headers(alice["access_token"]),
        json={"message": "How does persisted chat history work for signed-in users?"},
    )

    assert send_response.status_code == 200
    payload = send_response.json()
    assert payload["chat"]["title"] == "How does persisted chat history work for signed-in users?"
    assert payload["assistant_message"]["mode_used"] == "rag"
    assert payload["assistant_message"]["primary_citations"][0]["page_title"] == "Testing Guide"

    async with session_factory() as session:
        chat = await session.get(ChatSession, UUID(chat_id))
        assert chat is not None
        assert chat.title == "How does persisted chat history work for signed-in users?"

        result = await session.execute(
            select(ChatMessageRecord).where(ChatMessageRecord.chat_id == UUID(chat_id))
        )
        messages = result.scalars().all()
        assert len(messages) == 2
        assert {message.sender for message in messages} == {"user", "assistant"}


@pytest.mark.asyncio
async def test_stream_endpoint_persists_assistant_message_and_returns_chat_summary(chat_test_context):
    client: httpx.AsyncClient = chat_test_context["client"]

    alice = await register_user(client, "alice4@example.com")
    create_response = await client.post(
        "/api/v1/chats/",
        headers=auth_headers(alice["access_token"]),
    )
    chat_id = create_response.json()["id"]

    stream_response = await client.post(
        f"/api/v1/chats/{chat_id}/messages/stream",
        headers=auth_headers(alice["access_token"]),
        json={"message": "Stream this answer"},
    )

    assert stream_response.status_code == 200
    events = parse_sse_events(stream_response.text)
    assert [event["type"] for event in events] == ["token", "token", "done"]
    assert events[-1]["chat_summary"]["id"] == chat_id

    messages_response = await client.get(
        f"/api/v1/chats/{chat_id}/messages",
        headers=auth_headers(alice["access_token"]),
    )
    assert messages_response.status_code == 200
    items = messages_response.json()["items"]
    assert len(items) == 2
    assert items[-1]["content"] == "Streamed answer for: Stream this answer"


@pytest.mark.asyncio
async def test_voice_stream_endpoint_emits_voice_ready_and_persists_full_answer(chat_test_context, monkeypatch):
    client: httpx.AsyncClient = chat_test_context["client"]

    class FakeVoiceConversationService:
        async def create_voice_response(self, **kwargs):
            return "Short spoken answer."

    class FakeTTSService:
        def content_type(self) -> str:
            return "audio/mpeg"

        async def synthesize(self, **kwargs):
            return b"audio"

    previous_voice_service = chat_service.voice_conversation_service
    previous_tts_service = chat_service.tts_service
    monkeypatch.setattr(chat_service, "voice_conversation_service", FakeVoiceConversationService())
    monkeypatch.setattr(chat_service, "tts_service", FakeTTSService())

    alice = await register_user(client, "alice5@example.com")
    create_response = await client.post(
        "/api/v1/chats/",
        headers=auth_headers(alice["access_token"]),
    )
    chat_id = create_response.json()["id"]

    stream_response = await client.post(
        f"/api/v1/chats/{chat_id}/messages/stream",
        headers=auth_headers(alice["access_token"]),
        json={"message": "Stream this answer in voice mode", "voice_mode": True},
    )

    monkeypatch.setattr(chat_service, "voice_conversation_service", previous_voice_service)
    monkeypatch.setattr(chat_service, "tts_service", previous_tts_service)

    assert stream_response.status_code == 200
    events = parse_sse_events(stream_response.text)
    assert [event["type"] for event in events] == ["voice_ready", "token", "done"]
    assert events[0]["voice_response"] == "Short spoken answer."
    assert events[1]["content"] == "Answer for: Stream this answer in voice mode"
    assert events[-1]["chat_summary"]["id"] == chat_id

    messages_response = await client.get(
        f"/api/v1/chats/{chat_id}/messages",
        headers=auth_headers(alice["access_token"]),
    )
    assert messages_response.status_code == 200
    items = messages_response.json()["items"]
    assert len(items) == 2
    assert items[-1]["content"] == "Answer for: Stream this answer in voice mode"


@pytest.mark.asyncio
async def test_guest_chat_endpoint_remains_available(chat_test_context):
    client: httpx.AsyncClient = chat_test_context["client"]

    response = await client.post(
        "/api/v1/chat/",
        json={"message": "Guest question"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Answer for: Guest question"
    assert payload["mode_used"] == "rag"
