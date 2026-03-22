# Vanguard Architecture: RAG, Vectors, and Vector Databases

This document outlines the core AI mechanisms powering Project Vanguard. As a team, it is critical we understand how these three concepts work together to prevent AI hallucinations and provide accurate BookStack documentation to our users.

---

## 1. Retrieval-Augmented Generation (RAG)

### What is it?
Large Language Models (LLMs) like GPT-4o are incredibly smart, but they do not know our company's private internal data. If we ask a standard LLM about an Andino Global specific process, it will guess (hallucinate). RAG solves this by giving the LLM an "open-book test." 

### How Team Vanguard Uses It:
Instead of trying to train or fine-tune an AI model (which takes weeks and massive computing power), our FastAPI backend will execute a 3-step RAG pipeline in milliseconds:
1. **Retrieve:** When a user asks a question, we search our database for the exact BookStack paragraphs related to the question.
2. **Augment:** We combine the user's question with the BookStack paragraphs into a single prompt.
3. **Generate:** We send that combined prompt to `gpt-4o` with strict instructions: *"Answer the user's question using ONLY the provided BookStack text."*

---

## 2. Vectors (Embeddings)

### What are they?
To search text based on its *meaning* rather than exact keyword matches, we must translate human language into mathematics. A vector (or embedding) is an array of floating-point numbers that represents the semantic concept of a sentence. In this mathematical space, the phrase "password reset" is placed very close to "account recovery," even though they share no words.

### How Team Vanguard Uses Them:
We will use Azure OpenAI's `text-embedding-3-large` deployment through a provider-backed embedding adapter. 
* **During Setup:** Our Python script will download BookStack pages, split them into small paragraphs (chunks), and send them to Azure OpenAI. Azure OpenAI will return a vector (a list of 3,072 numbers) for each paragraph.
* **During Chat:** When a user types a question into our Next.js UI, the FastAPI backend will instantly convert their question into a new vector.

---

## 3. The Vector Database

### What is it?
Standard relational databases (like PostgreSQL) are built to find exact text matches (e.g., `SELECT * WHERE title = 'Login'`). Vector databases are engineered specifically to store these massive lists of numbers and perform lightning-fast mathematical comparisons.

### How Team Vanguard Uses It:
We are utilizing Pinecone (or Qdrant) as our Vector DB. 
1. **Storage:** It will hold our BookStack text chunks, their corresponding vectors, and metadata (like the original BookStack URL for our UI citations).
2. **Similarity Search:** When the FastAPI backend receives a user's question vector, Pinecone calculates the distance between that question and every BookStack paragraph we stored using **Cosine Similarity**. 
3. **The Guardrail:** Pinecone returns the top 3-5 closest matches along with a "Confidence Score." If the score is too low (meaning we don't have a doc for their question), our backend will gracefully decline to answer, preventing the AI from making up false troubleshooting steps.
