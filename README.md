<div align="center">

# 🛡️ PROJECT VANGUARD
**The Future of Interactive Customer Support**

[![Hackathon](https://img.shields.io/badge/Event-Andino_Global_AI_Hackathon-blue?style=for-the-badge)](https://github.com/AbhayKauts21/Vanguard)
[![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen?style=for-the-badge)](#)
[![Python](https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python&logoColor=white)](#)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js&logoColor=white)](#)

*Transforming static documentation into a dynamic, conversational AI experience.*

[Demo Video Placeholder] • [Architecture] • [Getting Started]

</div>

---

## 💡 The Problem & Our Solution
> **Static documentation often leads to support tickets even for common questions.** Vanguard eliminates the friction of digging through dense wikis. We built an AI-powered avatar assistant that interacts with users naturally (via text or voice) and utilizes a **Retrieval-Augmented Generation (RAG)** pipeline to pull highly accurate troubleshooting steps directly from our BookStack knowledge repository.

---

## 🏗️ Interactive Architecture Flow

```mermaid
graph LR
    A[👤 User] -->|Asks Question| B(Next.js UI)
    B -->|API Request| C{FastAPI Gateway}
    C -->|1. Embed Query| D[OpenAI: text-embedding-3]
    C -->|2. Semantic Search| E[(Pinecone Vector DB)]
    E -->|3. Return Chunks| C
    C -->|4. Generate Contextual Answer| F[OpenAI: gpt-4o]
    F -->|5. Stream Text| B
    B -->|6. Render Video| G[HeyGen Avatar API]