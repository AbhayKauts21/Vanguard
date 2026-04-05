"""Intent classifier for routing queries between docs RAG and general chat."""

from __future__ import annotations

import re
from typing import Literal, Sequence

from loguru import logger

from app.adapters.azure_openai_client import azure_openai_client
from app.domain.schemas import AzureChatMessage, ConversationMessage

QueryIntent = Literal["docs", "general", "smalltalk"]

_SMALLTALK_PATTERNS = [
    re.compile(r"^(hi|hello|hey|hey there|hola|buenas)(\s+.*)?$", re.IGNORECASE),
    re.compile(r"^(good morning|good afternoon|good evening)(\s+.*)?$", re.IGNORECASE),
    re.compile(r"^(thanks|thank you|thankyou|gracias)(\s+.*)?$", re.IGNORECASE),
    re.compile(r"^(how are you|how's it going|how is it going)(\s+.*)?$", re.IGNORECASE),
    re.compile(r"^(bye|goodbye|see you|see ya)(\s+.*)?$", re.IGNORECASE),
]


def _history_snippet(history: Sequence[ConversationMessage] | None) -> str:
    if not history:
        return "None"

    lines: list[str] = []
    for message in history[-4:]:
        role = "User" if message.role == "user" else "Assistant"
        content = " ".join(message.content.split())
        if len(content) > 220:
            content = content[:217].rstrip() + "..."
        lines.append(f"{role}: {content}")
    return "\n".join(lines) or "None"


def _normalize_label(raw: str) -> QueryIntent:
    cleaned = raw.strip().lower()
    if "smalltalk" in cleaned:
        return "smalltalk"
    if "general" in cleaned:
        return "general"
    return "docs"


class QueryIntentService:
    """Classifies the latest user turn before retrieval begins."""

    def __init__(self, *, llm_client=azure_openai_client) -> None:
        self._llm_client = llm_client

    async def classify(
        self,
        question: str,
        *,
        history: Sequence[ConversationMessage] | None = None,
        locale: str = "en",
    ) -> QueryIntent:
        normalized = " ".join(question.strip().split())
        if self._is_obvious_smalltalk(normalized):
            return "smalltalk"

        messages = self._build_messages(
            question=normalized,
            history=history,
            locale=locale,
        )

        try:
            response = await self._llm_client.create_chat_completion(
                messages,
                temperature=0.0,
                max_tokens=8,
            )
            content = response.choices[0].message.content if response.choices else ""
            return _normalize_label(content or "")
        except Exception as exc:
            logger.warning(
                "query_intent.classification_failed",
                error=str(exc),
                locale=locale,
            )
            return "docs"

    def _is_obvious_smalltalk(self, question: str) -> bool:
        normalized = question.strip().lower()
        if not normalized:
            return False
        return any(pattern.match(normalized) for pattern in _SMALLTALK_PATTERNS)

    def _build_messages(
        self,
        *,
        question: str,
        history: Sequence[ConversationMessage] | None,
        locale: str,
    ) -> list[AzureChatMessage]:
        locale_hint = "Spanish" if locale.lower().startswith("es") else "English"
        system_prompt = (
            "Classify the latest user turn for routing before retrieval.\n"
            "Return exactly one label: docs, general, or smalltalk.\n"
            "Use docs when the user is asking about CLEO, Andino, product features, account actions, policies, internal workflows, uploaded documents, or any answer that should be grounded in company documentation.\n"
            "Use general for open-domain knowledge or generic help that does not depend on internal documentation.\n"
            "Use smalltalk for greetings, thanks, pleasantries, or casual chit-chat.\n"
            "If you are unsure, return docs."
        )
        user_prompt = (
            f"Locale language: {locale_hint}\n"
            f"Recent conversation:\n{_history_snippet(history)}\n\n"
            f"Latest user turn:\n{question}"
        )
        return [
            AzureChatMessage(role="system", content=system_prompt),
            AzureChatMessage(role="user", content=user_prompt),
        ]


query_intent_service = QueryIntentService()
