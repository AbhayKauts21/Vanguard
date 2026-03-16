"""OpenAI LLM client — chat completion with streaming support."""

from typing import AsyncGenerator, List, Dict

from loguru import logger

from app.core.config import settings
from app.core.prompts import RAG_SYSTEM_PROMPT, RAG_USER_PROMPT


class LLMClient:
    """Wraps OpenAI chat completions (Interface Segregation — generation only)."""

    def __init__(self) -> None:
        self.model = settings.OPENAI_MODEL
        self._client = None

    def _get_client(self):
        """Lazy-init OpenAI client."""
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def generate(
        self,
        question: str,
        context_chunks: List[str],
        temperature: float = 0.2,
    ) -> str:
        """Generate a non-streaming response (used for simple calls)."""
        client = self._get_client()
        context = "\n\n---\n\n".join(context_chunks)

        try:
            response = client.chat.completions.create(
                model=self.model,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": RAG_SYSTEM_PROMPT.format(context=context)},
                    {"role": "user", "content": RAG_USER_PROMPT.format(question=question)},
                ],
            )
            return response.choices[0].message.content or ""

        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raise

    async def generate_stream(
        self,
        question: str,
        context_chunks: List[str],
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens for real-time UI response."""
        client = self._get_client()
        context = "\n\n---\n\n".join(context_chunks)

        try:
            stream = client.chat.completions.create(
                model=self.model,
                temperature=temperature,
                stream=True,
                messages=[
                    {"role": "system", "content": RAG_SYSTEM_PROMPT.format(context=context)},
                    {"role": "user", "content": RAG_USER_PROMPT.format(question=question)},
                ],
            )

            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content

        except Exception as e:
            logger.error(f"LLM streaming failed: {e}")
            raise


# Singleton instance
llm_client = LLMClient()
