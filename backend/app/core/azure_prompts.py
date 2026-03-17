"""Prompt-building utilities for direct Azure OpenAI chat."""

import json
from typing import Any, Dict, List

from app.domain.schemas import AzureChatMessage, AzureChatRequest

AZURE_CHAT_SYSTEM_PROMPT = (
    "You are an enterprise backend assistant. Answer the user's request using the "
    "provided input and structured context. If context is incomplete, say what is "
    "missing instead of inventing details."
)


def serialize_context(context: Dict[str, Any]) -> str:
    """Render structured request context deterministically for prompt assembly."""
    if not context:
        return "{}"
    return json.dumps(context, indent=2, sort_keys=True, default=str)


def build_azure_chat_messages(request: AzureChatRequest) -> List[AzureChatMessage]:
    """Convert the request into a stable two-message chat payload."""
    sections = [f"Prompt:\n{request.prompt.strip()}"]

    if request.input_text:
        sections.append(f"Input:\n{request.input_text.strip()}")

    sections.append(f"Context:\n{serialize_context(request.context)}")

    if request.metadata:
        sections.append(
            "Metadata:\n"
            + json.dumps(request.metadata, indent=2, sort_keys=True, default=str)
        )

    return [
        AzureChatMessage(role="system", content=AZURE_CHAT_SYSTEM_PROMPT),
        AzureChatMessage(role="user", content="\n\n".join(sections)),
    ]
