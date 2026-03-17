<div align="center">

# 🧠 CLEO
**Contextual Learning & Enterprise Oracle**

*The Future of Interactive Customer Support — built by Team Vanguard*

[![Hackathon](https://img.shields.io/badge/Event-Andino_Global_AI_Hackathon-blue?style=for-the-badge)](https://github.com/AbhayKauts21/Vanguard)
[![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen?style=for-the-badge)](#)
[![Python](https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](#)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](#)

*Transforming static documentation into a dynamic, conversational AI experience.*

[Architecture Deep Dive](docs/designs/hld_diagram.mmd) • [Data Flow](docs/data-flow/data_flow.md) • [RAG Concepts](docs/basic_concepts/RAG-VectorDB.md)

</div>

---

## 💡 The Problem & Our Solution
> **Static documentation often leads to support tickets even for common questions.** 
CLEO eliminates the friction of digging through dense wikis. We built an AI-powered avatar assistant that interacts with users naturally (via text or voice) and utilizes a **Retrieval-Augmented Generation (RAG)** pipeline to pull highly accurate troubleshooting steps directly from our BookStack knowledge repository.

---

## 🏗️ High-Level Architecture
CLEO is built on **Clean Architecture** and **Domain-Driven Design (DDD)** principles, ensuring that our AI logic is decoupled from external APIs and infrastructure.

```mermaid
graph TD
    User([👤 User]) -->|Interacts via| Next[Next.js Application]
    
    subgraph Frontend [Presentation Layer]
        Next -->|Feature UI| C[RadixUI + Tailwind]
        Next -->|Server State| T[TanStack Query]
    end

    Frontend -->|REST API| APIGateway[FastAPI Backend]

    subgraph Backend [Core Logic Layer]
        APIGateway -->|RAG Pipeline| RAGSvc[RAG Orchestrator]
        RAGSvc -->|Domain Logic| Domain[Domain Entities]
    end
    
    subgraph Infra [Infrastructure Layer]
        RAGSvc -->|Embed & Gen| OpenAI[OpenAI API]
        RAGSvc -->|Search| VectorDB[(Pinecone)]
        RAGSvc -->|Visual| HeyGen[HeyGen Avatar]
    end
```

---

## 🔄 Interactive Data Flow
When a user asks a question, the system orchestrates a multi-stage RAG pipeline to ensure accuracy and prevent hallucinations.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as Next.js UI
    participant Backend as FastAPI Svc
    participant VDB as Pinecone
    participant LLM as GPT-4o
    participant Avatar as HeyGen

    User->>Frontend: "How do I reset my password?"
    Frontend->>Backend: POST /api/chat
    Backend->>LLM: 1. Generate Embeddings
    LLM-->>Backend: Vector[1536]
    Backend->>VDB: 2. Semantic Search
    VDB-->>Backend: Top K Chunks + Scores
    
    Note over Backend: Confidence Check
    alt Score >= 0.8
        Backend->>LLM: 3. Contextual Generation
        LLM-->>Backend: Streamed Tokens
        Backend->>Avatar: 4. Visual Generation
        Backend-->>Frontend: Text Stream + Citations
        Avatar-->>Frontend: Video/Audio Stream
    else Score < 0.8
        Backend-->>Frontend: Graceful Decline (No Context Found)
    end
```

---

## 🛠️ Core Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19, Tailwind CSS | UI/UX & Responsive Design |
| **Backend** | Python, Flask / FastAPI | API Gateway & RAG Orchestration |
| **AI Generation** | OpenAI `gpt-4o` | Conversational Intelligence |
| **Embeddings** | `text-embedding-3-small` | Semantic Vectorization |
| **Vector Store** | Pinecone (Serverless) | Knowledge Storage & Similarity Search |
| **AV Avatar** | HeyGen Interactive API | Life-like Visual Interaction |
| **Observability** | OpenTelemetry | Distributed Tracing & Performance |

---

## 📜 Architectural Principles
We follow production-grade standards inspired by the **Checkingmate** ecosystem:
- **Clean Architecture:** Strict separation between business rules (RAG logic) and infrastructure (OpenAI/Pinecone).
- **Fail-Fast Error Handling:** Standardized error responses to prevent internal leaks.
- **Dependency Injection:** Making our services swapable and testable.
- **Observability First:** Distributed tracing from the UI to the Vector DB.

---

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AbhayKauts21/Vanguard.git
   ```
2. **Setup Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp .env.example .env # Fill in your API keys
   python main.py
   ```
3. **Setup Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

<p align="center">Built with ❤️ for the Andino Global AI Hackathon</p>