"""Azure Speech Services adapter — Text-to-Speech synthesis.

Uses the Azure Cognitive Services Speech SDK to convert text into
audio (MP3 by default). The adapter follows the lazy-init pattern
used by other CLEO adapters (AzureOpenAIClient, etc.).
"""

from __future__ import annotations

import io
from typing import Optional

from loguru import logger

from app.core.config import settings
from app.core.exceptions import AzureSpeechConfigError, AzureSpeechSynthesisError


class AzureSpeechClient:
    """Wraps Azure Cognitive Services Speech SDK for TTS."""

    def __init__(self) -> None:
        self._synthesizer = None
        self._speech_config = None

    def _validate_config(self) -> None:
        """Fail fast if Azure Speech credentials are missing."""
        missing = [
            name
            for name, value in (
                ("AZURE_SPEECH_KEY", settings.AZURE_SPEECH_KEY),
                ("AZURE_SPEECH_REGION", settings.AZURE_SPEECH_REGION),
            )
            if not value
        ]
        if missing:
            raise AzureSpeechConfigError(
                detail=f"Azure Speech is not configured. Missing: {', '.join(missing)}"
            )

    def _get_synthesizer(self):
        """Lazy-init the Azure Speech SDK synthesizer with pull audio stream."""
        self._validate_config()

        if self._synthesizer is None:
            import azure.cognitiveservices.speech as speechsdk

            self._speech_config = speechsdk.SpeechConfig(
                subscription=settings.AZURE_SPEECH_KEY,
                region=settings.AZURE_SPEECH_REGION,
            )

            # Map our config string to the SDK enum.
            output_format_map = {
                "audio-16khz-32kbitrate-mono-mp3": speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3,
                "audio-16khz-64kbitrate-mono-mp3": speechsdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3,
                "audio-24khz-48kbitrate-mono-mp3": speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3,
                "audio-24khz-96kbitrate-mono-mp3": speechsdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3,
                "audio-24khz-160kbitrate-mono-mp3": speechsdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3,
                "audio-48khz-96kbitrate-mono-mp3": speechsdk.SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3,
            }
            fmt = output_format_map.get(
                settings.AZURE_TTS_OUTPUT_FORMAT,
                speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3,
            )
            self._speech_config.set_speech_synthesis_output_format(fmt)
            self._speech_config.speech_synthesis_voice_name = settings.AZURE_TTS_VOICE

            # Synthesize to an in-memory pull stream (no file/speaker output).
            self._synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=self._speech_config,
                audio_config=None,  # in-memory
            )

            logger.info(
                "azure_speech.client_initialized",
                region=settings.AZURE_SPEECH_REGION,
                voice=settings.AZURE_TTS_VOICE,
                format=settings.AZURE_TTS_OUTPUT_FORMAT,
            )

        return self._synthesizer

    def reset_client(self) -> None:
        """Reset the lazy synthesizer — useful for tests or config reloads."""
        self._synthesizer = None
        self._speech_config = None

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        language: Optional[str] = None,
    ) -> bytes:
        """Synthesize *text* into audio bytes (MP3).

        Parameters
        ----------
        text:
            Plain text to convert to speech.
        voice:
            Override the default Azure TTS voice for this request.
        language:
            Optional language hint (e.g. ``en-US``). Currently used for
            SSML wrapping when a voice override is provided.

        Returns
        -------
        bytes
            Raw audio data in the configured output format.

        Raises
        ------
        AzureSpeechSynthesisError
            If the SDK returns a cancellation or error result.
        """
        synth = self._get_synthesizer()

        # If caller overrides voice, build a minimal SSML document.
        if voice and voice != settings.AZURE_TTS_VOICE:
            lang = language or "en-US"
            ssml = (
                f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{lang}">'
                f'<voice name="{voice}">{_escape_xml(text)}</voice>'
                f"</speak>"
            )
            logger.debug("azure_speech.ssml_override", voice=voice, text_length=len(text))
            result = synth.speak_ssml(ssml)
        else:
            result = synth.speak_text(text)

        import azure.cognitiveservices.speech as speechsdk

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            audio_data = result.audio_data
            logger.info(
                "azure_speech.synthesis_ok",
                text_length=len(text),
                audio_bytes=len(audio_data),
            )
            return audio_data

        # Handle errors
        cancellation = result.cancellation_details
        error_detail = (
            f"Speech synthesis failed: {cancellation.reason} — "
            f"{cancellation.error_details}"
            if cancellation
            else "Speech synthesis failed with unknown error."
        )
        logger.error("azure_speech.synthesis_error", detail=error_detail)
        raise AzureSpeechSynthesisError(detail=error_detail)

    async def synthesize_stream(
        self,
        text: str,
        voice: Optional[str] = None,
        language: Optional[str] = None,
    ):
        """Yield audio chunks as they are synthesized — for streaming responses.

        Uses the SDK's ``speak_text_async`` with an event-driven pull model.
        Falls back to full synthesis + chunk splitting if the pull stream
        isn't available.

        Yields
        ------
        bytes
            Audio data chunks (each ~4-16 KB depending on SDK buffering).
        """
        # For v1, synthesize full audio then yield in chunks for streaming response.
        # A future iteration can use the SDK's pull audio output stream for true
        # incremental delivery.
        audio_data = await self.synthesize(text, voice=voice, language=language)

        chunk_size = 8192  # 8 KB chunks
        stream = io.BytesIO(audio_data)
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                break
            yield chunk


def _escape_xml(text: str) -> str:
    """Minimal XML escape for SSML body text."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


# Module-level singleton (matches other adapter patterns).
azure_speech_client = AzureSpeechClient()
