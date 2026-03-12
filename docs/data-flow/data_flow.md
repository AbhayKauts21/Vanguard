# Architecture & Terminology Basics: Part 2

## 🔄 The Data Flow: Journey of a Question

When a user interacts with your AI Avatar, a highly orchestrated sequence of events happens in a matter of milliseconds. Here is the step-by-step breakdown based on our sequence diagrams:

### Step 1: The Request 🗣️
1. The user types or speaks a question into the **Next.js Frontend** (e.g., "How do I configure API authentication?").
2. The frontend sends an HTTP POST request containing this question to your **FastAPI Backend**.

### Step 2: Vectorization 🧮
1. Your FastAPI server receives the text. It cannot search BookStack directly with text efficiently.
2. It sends the question to the **OpenAI API** using the `text-embedding-3-small` model.
3. OpenAI translates the English sentence into a **Vector** (a massive array of numbers that represents the meaning of the question) and sends it back to FastAPI.

### Step 3: Similarity Search 🔍
1. FastAPI takes this new vector and sends a query to **Pinecone** (your Vector Database).
2. Pinecone compares the question's vector against all the vectors of your BookStack documents.
3. It returns the top 3-5 text chunks that mathematically align closest with the question, along with a **Confidence Score**.
4. *The Guardrail:* If the confidence score is too low, FastAPI rejects the request and tells the frontend, "I don't know the answer to that."

### Step 4: Generation 🧠
1. If the score is high enough, FastAPI builds a prompt. It combines the user's original question with the text chunks retrieved from Pinecone.
2. It sends this massive prompt to **OpenAI's `gpt-4o`**.
3. The LLM generates a conversational, step-by-step answer based *only* on the provided BookStack text. 
4. Because speed is critical, FastAPI "streams" this response back to the frontend token-by-token (word-by-word) instead of waiting for the whole paragraph to finish.

### Step 5: The Avatar Reacts 🎥
1. The Next.js frontend receives the streaming text.
2. It displays the text and the BookStack source links on the screen.
3. Simultaneously, it sends that text to the **HeyGen API**, which generates the video/audio stream of the Avatar speaking the answer in real-time.