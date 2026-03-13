# 🧠 LLM Generation Strategy: gpt-4o & gpt-4o-mini

## Why gpt-4o?
The "o" stands for "omni." It is OpenAI's flagship model, uniquely optimized for incredible speed and multimodal reasoning. In a customer support scenario, speed is everything. If the Avatar takes 10 seconds to respond, the user will leave. `gpt-4o` combined with streaming provides near-instantaneous first-token responses.

## Strategic Pivot for Development: gpt-4o-mini
While `gpt-4o` is the premium choice for the final presentation, Team Vanguard will use **`gpt-4o-mini`** for the majority of the development sprint.
* **The Reason:** During development, you will make hundreds of test queries. `gpt-4o-mini` is exceptionally smart, handles RAG contexts perfectly, and is remarkably cheap. We will switch the config variable back to `gpt-4o` right before the final demo.

## Cost Analysis
* **gpt-4o:** $5.00 per 1M input tokens / $15.00 per 1M output tokens.
* **gpt-4o-mini:** $0.150 per 1M input tokens / $0.600 per 1M output tokens. (Over 30x cheaper).

## Setup
Handled entirely through the OpenAI API via LangChain's `ChatOpenAI(model="gpt-4o", streaming=True)`. Ensure the `OPENAI_API_KEY` is loaded in the environment variables.

## Industry Alternatives
| Model | Pros | Cons | Why we didn't choose it |
| :--- | :--- | :--- | :--- |
| **Claude 3.5 Sonnet (Anthropic)** | arguably better at highly technical coding logic. | Different API structure. | We need maximum compatibility with Avatar APIs (HeyGen), which often default to OpenAI standards. |
| **Llama-3-70B (via Groq)** | Blazing fast (runs on specialized LPU hardware). | Context window limitations. | Groq's API rate limits on free tiers can bottleneck a team during heavy testing phases. |