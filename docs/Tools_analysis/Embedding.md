# 🧮 Embedding Model Strategy: text-embedding-3-small

## Why text-embedding-3-small?
When converting BookStack text into math, you need a model that captures deep semantic meaning. OpenAI's `text-embedding-3-small` is the current industry gold standard for cost-to-performance ratio. It outputs a 1536-dimensional vector, which provides incredibly high accuracy for troubleshooting queries.

## Setup & Implementation
No local setup is required. The model is accessed via the standard OpenAI REST API. 
* **Authentication:** Uses the exact same `OPENAI_API_KEY` as our text generation model.
* **Usage in Python:** We will use LangChain's wrapper `OpenAIEmbeddings(model="text-embedding-3-small")` to instantly convert our chunked text into vectors before pushing to Pinecone.

## Cost Analysis
* **Price:** $0.020 per 1,000,000 tokens (roughly 750,000 words).
* **Estimate:** If we process 1,000 pages of BookStack documentation (approx. 500,000 words), it will cost less than **$0.02** to vectorize the entire knowledge base.

## Industry Alternatives
| Model | Dimensions | Cost per 1M Tokens | Why we didn't choose it |
| :--- | :--- | :--- | :--- |
| **text-embedding-3-large** | 3072 | $0.130 | Six times more expensive, requires larger database storage, minimal accuracy gain for standard text. |
| **Cohere embed-english-v3** | 1024 | $0.100 | Excellent model, but requires managing a second vendor API key. |
| **all-MiniLM-L6-v2 (Local)** | 384 | $0.00 (Free) | Runs on your local CPU. Slower, less accurate, and risks crashing lightweight laptops during ingestion. |