"""Azure-backed LLM client used by the core RAG generation path."""

from typing import AsyncGenerator, List, Optional

from loguru import logger

from app.adapters.azure_openai_client import azure_openai_client
from app.core.config import settings
from app.core.prompts import RAG_SYSTEM_PROMPT, RAG_USER_PROMPT, VOICE_SYSTEM_PROMPT
from app.domain.schemas import AzureChatMessage, ConversationMessage


class LLMClient:
    """Wrap Azure OpenAI chat completions behind the stable generation interface."""

    def __init__(self) -> None:
        self.model = settings.AZURE_OPENAI_CHAT_DEPLOYMENT
        self._azure_client = azure_openai_client

    def _get_client(self):
        """Expose the underlying Azure client for health checks."""
        return self._azure_client._get_client()

    def _build_messages(
        self,
        *,
        question: str,
        context_chunks: List[str],
        history: Optional[List[ConversationMessage]],
        is_voice_mode: bool = False,
        vibe: str = "professional",
    ) -> List[AzureChatMessage]:
        """Build Azure-compatible messages for constrained RAG generation."""
        context = "\n\n---\n\n".join(context_chunks)
        history = history or []

        # Tier 1: System Prompt Selection
        if is_voice_mode:
            system_content = VOICE_SYSTEM_PROMPT.format(context=context, vibe=vibe)
        else:
            system_content = RAG_SYSTEM_PROMPT.format(context=context)

        messages = [
            AzureChatMessage(
                role="system",
                content=system_content,
            )
        ]
        for msg in history:
            messages.append(AzureChatMessage(role=msg.role, content=msg.content))

        messages.append(
            AzureChatMessage(
                role="user",
                content=RAG_USER_PROMPT.format(question=question),
            )
        )
        return messages

    async def generate(
        self,
        question: str,
        context_chunks: List[str],
        temperature: float = 0.2,
        history: Optional[List[ConversationMessage]] = None,
        is_voice_mode: bool = False,
        vibe: str = "professional",
    ) -> str:
        """Generate a non-streaming response for the RAG answer path."""
        messages = self._build_messages(
            question=question,
            context_chunks=context_chunks,
            history=history,
            is_voice_mode=is_voice_mode,
            vibe=vibe,
        )

        try:
            response = await self._azure_client.create_chat_completion(
                messages,
                temperature=temperature,
                max_tokens=None,
            )
            return response.choices[0].message.content or ""

        except Exception as exc:
            logger.error(f"Azure LLM generation failed: {exc}")
            raise

    async def generate_stream(
        self,
        question: str,
        context_chunks: List[str],
        temperature: float = 0.2,
        history: Optional[List[ConversationMessage]] = None,
        is_voice_mode: bool = False,
        vibe: str = "professional",
    ) -> AsyncGenerator[str, None]:
        """Stream tokens for real-time UI response."""
        messages = self._build_messages(
            question=question,
            context_chunks=context_chunks,
            history=history,
            is_voice_mode=is_voice_mode,
            vibe=vibe,
        )

        try:
            stream = self._azure_client.stream_chat_completion(
                messages,
                temperature=temperature,
                max_tokens=None,
            )
            async for token in stream:
                yield token

        except Exception as exc:
            logger.error(f"Azure LLM streaming failed: {exc}")
            raise


# Singleton instance
llm_client = LLMClient()
