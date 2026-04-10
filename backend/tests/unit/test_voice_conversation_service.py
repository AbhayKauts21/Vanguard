from types import SimpleNamespace

import pytest

from app.domain.schemas import ConversationMessage
from app.services.voice_conversation_service import (
    VOICE_MAX_COMPLETION_TOKENS,
    VOICE_SENTENCE_LIMIT,
    VoiceConversationService,
    clamp_voice_text,
    strip_markdown_for_voice,
)


def test_strip_markdown_for_voice_removes_common_markup():
    text = "### Reset\n- Click **Forgot Password** in the [portal](https://example.com).\n`code`"

    cleaned = strip_markdown_for_voice(text)

    assert "###" not in cleaned
    assert "**" not in cleaned
    assert "[" not in cleaned
    assert "portal" in cleaned
    assert "code" in cleaned


def test_clamp_voice_text_truncates_to_word_budget():
    text = " ".join(f"word{i}" for i in range(100))

    clipped = clamp_voice_text(text, max_words=20)

    assert len(clipped.split()) == 20
    assert clipped.endswith(".")


def test_clamp_voice_text_limits_sentence_count():
    text = (
        "Sentence one is concise. "
        "Sentence two stays relevant. "
        "Sentence three still fits. "
        "Sentence four should be removed."
    )

    clipped = clamp_voice_text(text, max_sentences=VOICE_SENTENCE_LIMIT)

    assert clipped.count(".") <= VOICE_SENTENCE_LIMIT
    assert "Sentence four" not in clipped


@pytest.mark.asyncio
async def test_voice_conversation_service_uses_llm_and_clamps_output():
    captured = {}

    class FakeLLMClient:
        async def create_chat_completion(self, messages, *, temperature, max_tokens):
            captured["messages"] = messages
            captured["temperature"] = temperature
            captured["max_tokens"] = max_tokens
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=(
                                "Here is your short answer in **plain speech**. "
                                "Try the password reset link next?"
                            )
                        )
                    )
                ]
            )

    service = VoiceConversationService(llm_client=FakeLLMClient())

    response = await service.create_voice_response(
        question="How do I reset my password?",
        answer="Use the Forgot Password link in the portal and follow the email link.",
        history=[ConversationMessage(role="user", content="I forgot my password.")],
        locale="en",
        mode_used="rag",
    )

    assert response == "Here is your short answer in plain speech. Try the password reset link next?"
    assert captured["temperature"] == 0.2
    assert captured["max_tokens"] == VOICE_MAX_COMPLETION_TOKENS
    assert captured["messages"][0].role == "system"
    assert captured["messages"][1].role == "user"


@pytest.mark.asyncio
async def test_voice_conversation_service_falls_back_to_clamped_plain_text():
    class FailingLLMClient:
        async def create_chat_completion(self, messages, *, temperature, max_tokens):
            raise RuntimeError("Azure rewrite unavailable")

    source_answer = (
        "### I couldn't verify this from the docs. "
        + " ".join(f"detail{i}" for i in range(120))
    )
    service = VoiceConversationService(llm_client=FailingLLMClient())

    response = await service.create_voice_response(
        question="Do we support SSO?",
        answer=source_answer,
        history=[],
        locale="en",
        mode_used="uncertain",
    )

    assert "###" not in response
    assert len(response.split()) <= 75
    assert "couldn't verify" in response.lower()


@pytest.mark.asyncio
async def test_voice_conversation_service_falls_back_when_llm_returns_empty_summary():
    class EmptyLLMClient:
        async def create_chat_completion(self, messages, *, temperature, max_tokens):
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="   "))]
            )

    service = VoiceConversationService(llm_client=EmptyLLMClient())

    response = await service.create_voice_response(
        question="How do I reset my password?",
        answer=(
            "Use the Forgot Password link in the portal. "
            "Follow the email link to set a new password. "
            "Contact support if the reset email does not arrive."
        ),
        history=[],
        locale="en",
        mode_used="rag",
    )

    assert response == (
        "Use the Forgot Password link in the portal. "
        "Follow the email link to set a new password. "
        "Contact support if the reset email does not arrive."
    )
