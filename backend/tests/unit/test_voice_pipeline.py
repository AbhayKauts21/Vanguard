"""Unit tests for TTS service, Azure Speech adapter, voice schemas and exceptions.

Tests cover:
- TTSRequest schema validation
- AzureSpeechConfigError / AzureSpeechSynthesisError exception classes
- TTS service input validation
- Azure Speech client config validation
"""

import pytest

from app.domain.schemas import TTSRequest
from app.core.exceptions import AzureSpeechConfigError, AzureSpeechSynthesisError
from app.adapters.azure_speech_client import AzureSpeechClient, _escape_xml
from app.services.tts_service import TTSService


# ── TTSRequest schema tests ──────────────────────────────────────

class TestTTSRequestSchema:
    """Pydantic model validation for TTSRequest."""

    def test_valid_request(self):
        req = TTSRequest(text="Hello world.")
        assert req.text == "Hello world."
        assert req.voice is None
        assert req.language is None
        assert req.stream is True  # default

    def test_valid_request_all_fields(self):
        req = TTSRequest(
            text="Hello",
            voice="en-US-GuyNeural",
            language="en-US",
            stream=False,
        )
        assert req.voice == "en-US-GuyNeural"
        assert req.language == "en-US"
        assert req.stream is False

    def test_empty_text_rejected(self):
        with pytest.raises(Exception):
            TTSRequest(text="")

    def test_max_length_enforced(self):
        """Text exceeding 5000 chars should be rejected."""
        with pytest.raises(Exception):
            TTSRequest(text="a" * 5001)

    def test_max_length_at_boundary(self):
        req = TTSRequest(text="a" * 5000)
        assert len(req.text) == 5000


# ── Exception tests ──────────────────────────────────────────────

class TestAzureSpeechExceptions:
    """Verify exception hierarchy and defaults."""

    def test_config_error_default_message(self):
        exc = AzureSpeechConfigError()
        assert "Azure Speech configuration" in exc.detail
        assert exc.status_code == 500

    def test_config_error_custom_message(self):
        exc = AzureSpeechConfigError(detail="Missing AZURE_SPEECH_KEY")
        assert "AZURE_SPEECH_KEY" in exc.detail
        assert exc.status_code == 500

    def test_synthesis_error_default_message(self):
        exc = AzureSpeechSynthesisError()
        assert "synthesis failed" in exc.detail
        assert exc.status_code == 502

    def test_synthesis_error_custom_message(self):
        exc = AzureSpeechSynthesisError(detail="CancellationReason: Error")
        assert "CancellationReason" in exc.detail


# ── Azure Speech client config validation ────────────────────────

class TestAzureSpeechClientValidation:
    """Azure Speech adapter config validation (without requiring the SDK)."""

    def test_validate_config_raises_on_empty_key(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "AZURE_SPEECH_KEY", "")
        monkeypatch.setattr(settings, "AZURE_SPEECH_REGION", "eastus")

        client = AzureSpeechClient()
        with pytest.raises(AzureSpeechConfigError) as exc_info:
            client._validate_config()

        assert "AZURE_SPEECH_KEY" in exc_info.value.detail

    def test_validate_config_raises_on_empty_region(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "AZURE_SPEECH_KEY", "test-key")
        monkeypatch.setattr(settings, "AZURE_SPEECH_REGION", "")

        client = AzureSpeechClient()
        with pytest.raises(AzureSpeechConfigError) as exc_info:
            client._validate_config()

        assert "AZURE_SPEECH_REGION" in exc_info.value.detail

    def test_validate_config_passes_when_configured(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "AZURE_SPEECH_KEY", "test-key")
        monkeypatch.setattr(settings, "AZURE_SPEECH_REGION", "eastus")

        client = AzureSpeechClient()
        # Should not raise
        client._validate_config()

    def test_reset_client_clears_synthesizer(self):
        client = AzureSpeechClient()
        client._synthesizer = "fake"  # type: ignore
        client._speech_config = "fake"  # type: ignore

        client.reset_client()

        assert client._synthesizer is None
        assert client._speech_config is None


# ── XML escaping ─────────────────────────────────────────────────

class TestXmlEscape:
    """Ensure SSML body text is properly escaped."""

    def test_basic_escape(self):
        assert _escape_xml("a & b") == "a &amp; b"

    def test_angle_brackets(self):
        assert _escape_xml("<tag>") == "&lt;tag&gt;"

    def test_quotes(self):
        assert _escape_xml('say "hello"') == "say &quot;hello&quot;"

    def test_apostrophe(self):
        assert _escape_xml("it's") == "it&apos;s"

    def test_combined(self):
        result = _escape_xml('<a href="x">&</a>')
        assert "&lt;" in result
        assert "&amp;" in result
        assert "&quot;" in result


# ── TTS service input validation ─────────────────────────────────

class TestTTSServiceValidation:
    """TTS service layer validates inputs before calling adapter."""

    @pytest.mark.asyncio
    async def test_synthesize_rejects_empty_text(self):
        service = TTSService()
        with pytest.raises(ValueError, match="must not be empty"):
            await service.synthesize("")

    @pytest.mark.asyncio
    async def test_synthesize_rejects_whitespace_only(self):
        service = TTSService()
        with pytest.raises(ValueError, match="must not be empty"):
            await service.synthesize("   ")

    @pytest.mark.asyncio
    async def test_synthesize_stream_rejects_empty_text(self):
        service = TTSService()
        with pytest.raises(ValueError, match="must not be empty"):
            async for _ in service.synthesize_stream(""):
                pass

    @pytest.mark.asyncio
    async def test_synthesize_stream_rejects_whitespace_only(self):
        service = TTSService()
        with pytest.raises(ValueError, match="must not be empty"):
            async for _ in service.synthesize_stream("   "):
                pass
