from types import SimpleNamespace
import sys

import pytest

from app.adapters.azure_openai_client import AzureOpenAIClient
from app.core.azure_prompts import build_azure_chat_messages
from app.core.config import settings, validate_azure_openai_settings
from app.core.exceptions import AzureConfigurationError, AzureOpenAIError
from app.domain.schemas import AzureChatRequest
from app.services.azure_chat_service import AzureChatService


def test_validate_azure_openai_settings_requires_required_fields(monkeypatch):
    monkeypatch.setattr(settings, "AZURE_OPENAI_ENDPOINT", "")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_KEY", "")
    monkeypatch.setattr(settings, "AZURE_OPENAI_CHAT_DEPLOYMENT", "")

    with pytest.raises(AzureConfigurationError) as exc:
        validate_azure_openai_settings(settings)

    assert "AZURE_OPENAI_ENDPOINT" in exc.value.detail
    assert "AZURE_OPENAI_API_KEY" in exc.value.detail
    assert "AZURE_OPENAI_CHAT_DEPLOYMENT" in exc.value.detail


def test_prompt_builder_serializes_context_deterministically():
    request = AzureChatRequest(
        conversation_id="conv-1",
        prompt="Summarize the incident",
        input_text="User report body",
        context={"z": 2, "a": {"nested": True}},
        metadata={"trace_id": "abc123"},
    )

    messages = build_azure_chat_messages(request)

    assert messages[0].role == "system"
    assert messages[1].role == "user"
    assert "Prompt:\nSummarize the incident" in messages[1].content
    assert "Input:\nUser report body" in messages[1].content
    assert '"a": {' in messages[1].content
    assert '"z": 2' in messages[1].content
    assert '"trace_id": "abc123"' in messages[1].content


@pytest.mark.asyncio
async def test_service_runs_middlewares_in_order(monkeypatch):
    events = []
    service = AzureChatService()

    class TrackingMiddleware:
        async def before_request(self, request, messages):
            events.append(("before", request.prompt, len(messages)))

        async def after_response(self, request, messages, raw_response, response):
            events.append(("after", response.output_text, response.deployment))

        async def on_error(self, request, messages, error):
            events.append(("error", str(error)))

    async def fake_create_chat_completion(messages, *, temperature, max_tokens):
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="azure-output"))],
            usage=SimpleNamespace(prompt_tokens=12, completion_tokens=4, total_tokens=16),
            _request_id="req-123",
        )

    service.register_middleware(TrackingMiddleware())
    monkeypatch.setattr(
        "app.services.azure_chat_service.azure_openai_client.create_chat_completion",
        fake_create_chat_completion,
    )
    monkeypatch.setattr(settings, "AZURE_OPENAI_CHAT_DEPLOYMENT", "chat-prod")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_VERSION", "2024-10-21")

    response = await service.create_chat(
        AzureChatRequest(prompt="Hello", context={"team": "support"})
    )

    assert response.output_text == "azure-output"
    assert response.deployment == "chat-prod"
    assert response.request_id == "req-123"
    assert response.usage.total_tokens == 16
    assert events == [
        ("before", "Hello", 2),
        ("after", "azure-output", "chat-prod"),
    ]


@pytest.mark.asyncio
async def test_service_calls_error_middleware_on_failure(monkeypatch):
    events = []
    service = AzureChatService()

    class TrackingMiddleware:
        async def before_request(self, request, messages):
            events.append("before")

        async def after_response(self, request, messages, raw_response, response):
            events.append("after")

        async def on_error(self, request, messages, error):
            events.append(type(error).__name__)

    async def failing_create_chat_completion(messages, *, temperature, max_tokens):
        raise AzureOpenAIError("boom")

    service.register_middleware(TrackingMiddleware())
    monkeypatch.setattr(
        "app.services.azure_chat_service.azure_openai_client.create_chat_completion",
        failing_create_chat_completion,
    )

    with pytest.raises(AzureOpenAIError):
        await service.create_chat(AzureChatRequest(prompt="Hello", context={}))

    assert events == ["before", "AzureOpenAIError"]


@pytest.mark.asyncio
async def test_azure_client_builds_sdk_request_with_base_url_and_deployment(monkeypatch):
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured["payload"] = kwargs
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))]
            )

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeAzureOpenAI:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs
            self.chat = FakeChat()

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(AzureOpenAI=FakeAzureOpenAI))
    monkeypatch.setattr(settings, "AZURE_OPENAI_ENDPOINT", "https://demo.openai.azure.com/")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_KEY", "secret")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_VERSION", "2024-10-21")
    monkeypatch.setattr(settings, "AZURE_OPENAI_CHAT_DEPLOYMENT", "chat-prod")
    monkeypatch.setattr(settings, "AZURE_OPENAI_TIMEOUT_SECONDS", 15.0)
    monkeypatch.setattr(settings, "AZURE_OPENAI_MAX_RETRIES", 4)

    client = AzureOpenAIClient()
    messages = build_azure_chat_messages(
        AzureChatRequest(prompt="Hello", context={"a": 1})
    )

    response = await client.create_chat_completion(
        messages, temperature=0.3, max_tokens=120
    )

    assert response.choices[0].message.content == "ok"
    assert captured["client_kwargs"]["azure_endpoint"] == "https://demo.openai.azure.com/"
    assert captured["client_kwargs"]["api_key"] == "secret"
    assert captured["client_kwargs"]["api_version"] == "2024-10-21"
    assert captured["client_kwargs"]["timeout"] == 15.0
    assert captured["client_kwargs"]["max_retries"] == 4
    assert captured["payload"]["model"] == "chat-prod"
    assert captured["payload"]["max_tokens"] == 120


@pytest.mark.asyncio
async def test_azure_client_stream_ignores_chunks_without_choices(monkeypatch):
    class FakeChunk:
        def __init__(self, choices):
            self.choices = choices

    class FakeCompletions:
        def create(self, **kwargs):
            return iter(
                [
                    FakeChunk([]),
                    FakeChunk([SimpleNamespace(delta=SimpleNamespace(content="hello"))]),
                    FakeChunk([SimpleNamespace(delta=SimpleNamespace(content=None))]),
                    FakeChunk([SimpleNamespace(delta=SimpleNamespace(content=" world"))]),
                ]
            )

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeAzureOpenAI:
        def __init__(self, **kwargs):
            self.chat = FakeChat()

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(AzureOpenAI=FakeAzureOpenAI))
    monkeypatch.setattr(settings, "AZURE_OPENAI_ENDPOINT", "https://demo.openai.azure.com/")
    monkeypatch.setattr(settings, "AZURE_OPENAI_API_KEY", "secret")
    monkeypatch.setattr(settings, "AZURE_OPENAI_CHAT_DEPLOYMENT", "chat-prod")

    client = AzureOpenAIClient()
    messages = build_azure_chat_messages(
        AzureChatRequest(prompt="Hello", context={"a": 1})
    )

    tokens = []
    async for token in client.stream_chat_completion(
        messages,
        temperature=0.2,
        max_tokens=None,
    ):
        tokens.append(token)

    assert tokens == ["hello", " world"]
