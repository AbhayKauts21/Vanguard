from types import SimpleNamespace

import pytest

from app.adapters.llm_client import LLMClient
from app.domain.schemas import ConversationMessage


@pytest.mark.asyncio
async def test_llm_client_uses_azure_completion_for_generation(monkeypatch):
    captured = {}
    client = LLMClient()

    async def fake_create_chat_completion(messages, *, temperature, max_tokens):
        captured["messages"] = [message.model_dump() for message in messages]
        captured["temperature"] = temperature
        captured["max_tokens"] = max_tokens
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="grounded answer"))]
        )

    monkeypatch.setattr(client._azure_client, "create_chat_completion", fake_create_chat_completion)

    answer = await client.generate(
        question="How do I reset my password?",
        context_chunks=["Use the reset password page and confirm your email."],
        history=[ConversationMessage(role="user", content="I need help logging in.")],
    )

    assert answer == "grounded answer"
    assert captured["temperature"] == 0.2
    assert captured["max_tokens"] is None
    assert captured["messages"][0]["role"] == "system"
    assert "Use the reset password page" in captured["messages"][0]["content"]
    assert captured["messages"][1] == {"role": "user", "content": "I need help logging in."}
    assert "How do I reset my password?" in captured["messages"][2]["content"]


@pytest.mark.asyncio
async def test_llm_client_streams_tokens_from_azure(monkeypatch):
    client = LLMClient()

    async def fake_stream_chat_completion(messages, *, temperature, max_tokens):
        yield "hello"
        yield " world"

    monkeypatch.setattr(client._azure_client, "stream_chat_completion", fake_stream_chat_completion)

    tokens = []
    async for token in client.generate_stream(
        question="What is SSO?",
        context_chunks=["SSO lets users sign in through a central identity provider."],
    ):
        tokens.append(token)

    assert tokens == ["hello", " world"]
