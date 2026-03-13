# 🗄️ Vector Database Strategy: Pinecone

## Why Pinecone?
For a rapid prototype, infrastructure management is a massive time sink. We selected Pinecone because it is a fully managed, serverless vector database. There are no docker containers to spin up, no memory limits to tune, and no local storage to manage. It integrates flawlessly with Python and LangChain.

## Step-by-Step Setup Guide
1. **Account Creation:** Go to [Pinecone.io](https://www.pinecone.io/) and sign up.
2. **Create an Index:** An "Index" is like a table in a SQL database. 
   * **Name:** `vanguard-docs`
   * **Dimensions:** `1536` *(CRITICAL: This number must exactly match the output of our embedding model, text-embedding-3-small).*
   * **Metric:** `Cosine` (This calculates the angle between vectors to find similarity).
   * **Pod Type:** Select `Serverless` and choose `AWS` as the cloud provider.
3. **API Keys:** Navigate to the "API Keys" tab. Copy your key and place it in the backend `.env` file as `PINECONE_API_KEY`. 

## Cost Analysis
* **Serverless Free Tier:** $0.00. You get 1 free serverless index with up to 2GB of storage. 
* **Capacity:** 2GB can hold roughly 2 to 3 million BookStack paragraphs. This is more than enough to ingest the entire company documentation for free.

## Industry Alternatives
| Database | Pros | Cons | Why we didn't choose it |
| :--- | :--- | :--- | :--- |
| **Qdrant** | Open source, can run locally. | Requires Docker setup for local use. | Slower to set up than Pinecone Serverless. |
| **pgvector** | Built directly into PostgreSQL. | Harder to scale, complex indexing. | Overkill if we don't already have a Postgres DB running. |
| **ChromaDB** | Runs entirely in local memory. | Wipes data if the server restarts. | Not suitable for a deployable, cloud-ready prototype. |