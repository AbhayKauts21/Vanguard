"""Manual smoke test for the Azure OpenAI direct-chat module.

Run from the backend directory:
    ./venv/bin/python scripts/test_azure_chat.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Keep the smoke test independent from non-boolean DEBUG values in .env.
os.environ["DEBUG"] = "true"

from app.domain.schemas import AzureChatRequest
from app.services.azure_chat_service import azure_chat_service


async def main() -> None:
    request = AzureChatRequest(
        conversation_id="smoke-test-001",
        prompt=(
            "Summarize the user input in 2 bullet points and end with a one-line "
            "recommended next step."
        ),
        input_text=(
            "Our support team needs an Azure OpenAI integration for a backend "
            "service that accepts prompt and context, then returns a response."
        ),
        context={
            "project": "Vanguard",
            "environment": "backend smoke test",
            "goal": "Verify Azure OpenAI direct chat is configured correctly",
            "constraints": [
                "keep the answer concise",
                "do not invent missing product details",
            ],
        },
        metadata={
            "source": "manual-script",
        },
    )

    response = await azure_chat_service.create_chat(request)

    print("\n=== Azure Chat Smoke Test ===")
    print(f"conversation_id: {response.conversation_id}")
    print(f"deployment: {response.deployment}")
    print(f"request_id: {response.request_id}")
    print("output_text:")
    print(response.output_text)
    print("usage:")
    print(json.dumps(response.usage.model_dump() if response.usage else {}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
