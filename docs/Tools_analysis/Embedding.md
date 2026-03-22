# 🧮 Embedding Model Strategy: Azure `text-embedding-3-large`

## Why Azure text-embedding-3-large?
When converting BookStack text into math, you need a model that captures deep semantic meaning and aligns with the project deployment target. Azure OpenAI's `text-embedding-3-large` provides stronger retrieval quality than the smaller model and outputs a 3072-dimensional vector, which is now the project default.

## Setup & Implementation
No local setup is required. The model is accessed via Azure OpenAI using the OpenAI SDK-compatible endpoint format. 
* **Authentication:** Uses `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and the embedding deployment name.
* **Usage in Python:** The backend resolves an `EmbeddingProvider` strategy and calls the Azure deployment before pushing vectors to Pinecone.

## Cost Analysis
* **Price:** $0.020 per 1,000,000 tokens (roughly 750,000 words).
* **Estimate:** If we process 1,000 pages of BookStack documentation (approx. 500,000 words), it will cost less than **$0.02** to vectorize the entire knowledge base.

## Industry Alternatives
| Model | Dimensions | Cost per 1M Tokens | Why we didn't choose it |
| :--- | :--- | :--- | :--- |
| **text-embedding-3-small** | 1536 | $0.020 | Lower cost and faster, but below the current project quality target. |
| **Cohere embed-english-v3** | 1024 | $0.100 | Excellent model, but requires managing a second vendor API key. |
| **all-MiniLM-L6-v2 (Local)** | 384 | $0.00 (Free) | Runs on your local CPU. Slower, less accurate, and risks crashing lightweight laptops during ingestion. |
