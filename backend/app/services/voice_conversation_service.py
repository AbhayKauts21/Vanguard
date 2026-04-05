"""Voice conversation rewrite service for short spoken avatar replies."""

from __future__ import annotations

import re
from typing import Iterable, Sequence

from loguru import logger

from app.adapters.azure_openai_client import azure_openai_client
from app.domain.schemas import AzureChatMessage, ConversationMessage

VOICE_WORD_LIMIT = 75
VOICE_MAX_COMPLETION_TOKENS = 180
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def strip_markdown_for_voice(text: str) -> str:
    """Convert markdown-heavy assistant text into plain speakable prose."""
    cleaned = text or ""
    cleaned = re.sub(r"```[\s\S]*?```", " ", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", cleaned)
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*[-*+]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*\d+\.\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"[*_~>#]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def clamp_voice_text(text: str, max_words: int = VOICE_WORD_LIMIT) -> str:
    """Keep the spoken reply short and sentence-friendly for voice mode."""
    plain_text = strip_markdown_for_voice(text)
    if not plain_text:
        return ""

    words = plain_text.split()
    if len(words) <= max_words:
        return plain_text

    selected_sentences: list[str] = []
    current_count = 0
    for sentence in _split_sentences(plain_text):
        sentence_words = sentence.split()
        if not sentence_words:
            continue
        if selected_sentences and current_count + len(sentence_words) > max_words:
            break
        selected_sentences.append(sentence)
        current_count += len(sentence_words)
        if current_count >= max_words:
            break

    if selected_sentences:
        candidate = " ".join(selected_sentences).strip()
        if len(candidate.split()) <= max_words:
            return candidate

    truncated = " ".join(words[:max_words]).strip()
    if truncated and truncated[-1] not in ".!?":
        truncated = f"{truncated}."
    return truncated


def _split_sentences(text: str) -> Iterable[str]:
    return [segment.strip() for segment in _SENTENCE_SPLIT_RE.split(text) if segment.strip()]


def _history_snippet(history: Sequence[ConversationMessage] | None) -> str:
    if not history:
        return "None"

    lines = []
    for message in history[-4:]:
        role = "User" if message.role == "user" else "Assistant"
        content = strip_markdown_for_voice(message.content)
        if len(content) > 180:
            content = content[:177].rstrip() + "..."
        lines.append(f"{role}: {content}")
    return "\n".join(lines) or "None"


class VoiceConversationService:
    """Builds short spoken-turn responses from a full grounded answer."""

    def __init__(self, *, llm_client=azure_openai_client) -> None:
        self._llm_client = llm_client

    async def create_voice_response(
        self,
        *,
        question: str,
        answer: str,
        history: Sequence[ConversationMessage] | None = None,
        locale: str = "en",
        mode_used: str = "rag",
    ) -> str:
        fallback = clamp_voice_text(answer)
        if not fallback:
            return ""

        messages = self._build_messages(
            question=question,
            answer=answer,
            history=history,
            locale=locale,
            mode_used=mode_used,
        )

        try:
            response = await self._llm_client.create_chat_completion(
                messages,
                temperature=0.4,
                max_tokens=VOICE_MAX_COMPLETION_TOKENS,
            )
            candidate = response.choices[0].message.content if response.choices else ""
            rewritten = clamp_voice_text(candidate or "")
            return rewritten or fallback
        except Exception as exc:
            logger.warning(
                "voice_conversation.rewrite_failed",
                error=str(exc),
                locale=locale,
                mode_used=mode_used,
            )
            return fallback

    def _build_messages(
        self,
        *,
        question: str,
        answer: str,
        history: Sequence[ConversationMessage] | None,
        locale: str,
        mode_used: str,
    ) -> list[AzureChatMessage]:
        locale_hint = "Spanish" if locale.lower().startswith("es") else "English"
        system_prompt = (
            "You rewrite a grounded assistant answer into a short spoken reply for voice mode.\n"
            "Rules:\n"
            "- Use the same language as the user's locale and source answer.\n"
            "- Never add facts, steps, policies, or claims that are not already present in the source answer.\n"
            "- Preserve uncertainty, missing-documentation language, and fallback tone when present.\n"
            "- Use plain conversational prose only. No markdown, bullets, headings, citations, or source lists.\n"
            f"- Keep the reply to {VOICE_WORD_LIMIT} words or fewer.\n"
            "- End with at most one brief relevant follow-up question or next step only when it naturally fits.\n"
            "- Return only the spoken reply."
        )
        user_prompt = (
            f"Locale language: {locale_hint}\n"
            f"Mode used: {mode_used}\n"
            f"User question: {question.strip()}\n"
            f"Recent conversation:\n{_history_snippet(history)}\n\n"
            f"Source answer:\n{answer.strip()}"
        )

        return [
            AzureChatMessage(role="system", content=system_prompt),
            AzureChatMessage(role="user", content=user_prompt),
        ]


voice_conversation_service = VoiceConversationService()
