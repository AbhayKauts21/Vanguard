"""Azure-backed LLM client for RAG generation."""

from typing import AsyncGenerator, List, Optional
from loguru import logger
from app.adapters.azure_openai_client import azure_openai_client
from app.core.config import settings
from app.core.prompts import RAG_SYSTEM_PROMPT, RAG_USER_PROMPT, VOICE_SYSTEM_PROMPT
from app.domain.schemas import AzureChatMessage, ConversationMessage

class LLMClient:
    """Wrapper for Azure OpenAI chat completions."""

    def __init__(self) -> None:
        self.model = settings.AZURE_OPENAI_CHAT_DEPLOYMENT
        self._azure_client = azure_openai_client

    def _get_client(self):
        return self._azure_client._get_client()

    def _build_messages(
        self,
        *,
        question: str,
        context_chunks: List[str],
        history: Optional[List[ConversationMessage]],
        is_voice_mode: bool = False,
        vibe: str = "professional",
        local_time: Optional[str] = None,
        location: Optional[str] = None,
        interrupted_context: Optional[str] = None,
    ) -> List[AzureChatMessage]:
        """Build messages for RAG generation."""
        context = "\n\n---\n\n".join(context_chunks)
        history = history or []

        if is_voice_mode:
            system_content = VOICE_SYSTEM_PROMPT.format(context=context, vibe=vibe)
        else:
            system_content = RAG_SYSTEM_PROMPT.format(context=context)

        live_metadata = []
        if local_time: live_metadata.append(f"CURRENT_TIME: {local_time}")
        if location: live_metadata.append(f"CURRENT_LOCATION: {location}")
        if interrupted_context:
            live_metadata.append(f"USER_INTERRUPTED_PREVIOUS: \"{interrupted_context}\"")
            live_metadata.append("INSTRUCTION: Pivot naturally to the new query after acknowledging the interruption.")

        if live_metadata:
            system_content += "\n\nLIVE_CONTEXT:\n" + "\n".join(live_metadata)

        messages = [AzureChatMessage(role="system", content=system_content)]
        for msg in history:
            messages.append(AzureChatMessage(role=msg.role, content=msg.content))

        messages.append(AzureChatMessage(role="user", content=RAG_USER_PROMPT.format(question=question)))
        return messages

    async def generate(
        self,
        question: str,
        context_chunks: List[str],
        temperature: float = 0.2,
        history: Optional[List[ConversationMessage]] = None,
        is_voice_mode: bool = False,
        vibe: str = "professional",
        local_time: Optional[str] = None,
        location: Optional[str] = None,
        interrupted_context: Optional[str] = None,
    ) -> str:
        """Non-streaming generation."""
        messages = self._build_messages(
            question=question,
            context_chunks=context_chunks,
            history=history,
            is_voice_mode=is_voice_mode,
            vibe=vibe,
            local_time=local_time,
            location=location,
            interrupted_context=interrupted_context,
        )

        try:
            response = await self._azure_client.create_chat_completion(messages, temperature=temperature)
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.error(f"Azure generation failed: {exc}")
            raise

    async def generate_stream(
        self,
        question: str,
        context_chunks: List[str],
        temperature: float = 0.2,
        history: Optional[List[ConversationMessage]] = None,
        is_voice_mode: bool = False,
        vibe: str = "professional",
        local_time: Optional[str] = None,
        location: Optional[str] = None,
        interrupted_context: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming generation."""
        messages = self._build_messages(
            question=question,
            context_chunks=context_chunks,
            history=history,
            is_voice_mode=is_voice_mode,
            vibe=vibe,
            local_time=local_time,
            location=location,
            interrupted_context=interrupted_context,
        )
        try:
            stream = self._azure_client.stream_chat_completion(messages, temperature=temperature)
            async for token in stream:
                yield token
        except Exception as exc:
            logger.error(f"Azure streaming failed: {exc}")
            raise

llm_client = LLMClient()
