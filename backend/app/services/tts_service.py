"""TTS service — orchestrates Azure Speech synthesis for the voice pipeline.

Provides a thin service layer between the voice router and the Azure Speech
adapter, adding request validation, logging, and a clean async interface.
"""

from typing import AsyncIterator, Optional

from loguru import logger

from app.adapters.azure_speech_client import azure_speech_client
from app.core.config import settings


class TTSService:
    """Text-to-Speech service — converts text to audio via Azure Speech."""

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        language: Optional[str] = None,
    ) -> bytes:
        """Synthesize text into audio bytes.

        Parameters
        ----------
        text:
            The text to synthesize. Empty strings are rejected.
        voice:
            Override the configured Azure TTS voice.
        language:
            Optional language hint for SSML.

        Returns
        -------
        bytes
            Raw audio in the configured output format (e.g. MP3).
        """
        if not text or not text.strip():
            raise ValueError("TTS text must not be empty.")

        effective_voice = voice or settings.AZURE_TTS_VOICE
        logger.info(
            "tts_service.synthesize",
            text_length=len(text),
            voice=effective_voice,
            language=language,
        )

        return await azure_speech_client.synthesize(
            text=text.strip(),
            voice=voice,
            language=language,
        )

    async def synthesize_stream(
        self,
        text: str,
        voice: Optional[str] = None,
        language: Optional[str] = None,
    ) -> AsyncIterator[bytes]:
        """Stream audio chunks from Azure Speech synthesis.

        Yields
        ------
        bytes
            Audio data chunks suitable for a streaming HTTP response.
        """
        if not text or not text.strip():
            raise ValueError("TTS text must not be empty.")

        effective_voice = voice or settings.AZURE_TTS_VOICE
        logger.info(
            "tts_service.synthesize_stream",
            text_length=len(text),
            voice=effective_voice,
            language=language,
        )

        async for chunk in azure_speech_client.synthesize_stream(
            text=text.strip(),
            voice=voice,
            language=language,
        ):
            yield chunk


# Module-level singleton.
tts_service = TTSService()
