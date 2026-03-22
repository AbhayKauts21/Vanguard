# 🔧 CLEO Backend Setup & Running Guide

## Prerequisites

- **Python 3.12+** installed
- **pip** or **poetry** package manager
- **Virtual environment tool** (venv, virtualenv, or conda)

## Quick Start

### 1. Navigate to Backend Directory

```bash
cd /Users/mac1/Desktop/project-vanguard/backend
```

### 2. Create Virtual Environment

#### Option A: Using `venv` (Built-in)
```bash
python3.12 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows
```

#### Option B: Using `conda`
```bash
conda create -n cleo python=3.12
conda activate cleo
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in `backend/` directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

```env
# === Project ===
PROJECT_NAME=CLEO
DEBUG=true

# === OpenAI (RAG Pipeline) ===
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# === Azure OpenAI (Direct Chat) ===
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_CHAT_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# === Pinecone ===
PINECONE_API_KEY=pcsk_YOUR_KEY_HERE
PINECONE_INDEX_NAME=cleo-docs
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

# === BookStack ===
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id
BOOKSTACK_TOKEN_SECRET=your_token_secret
BOOKSTACK_WEBHOOK_SECRET=your_webhook_secret

# === Tuning ===
CHUNK_SIZE=800
CHUNK_OVERLAP=200
MIN_SIMILARITY_SCORE=0.78
SYNC_INTERVAL_MINUTES=5
TOP_K_RESULTS=5

# === Admin ===
ADMIN_API_KEY=change-me-in-production
```

### 5. Run the Backend Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process [1234]
INFO:     Waiting for application startup.
```

### 6. Verify Backend is Running

Open your browser or use `curl`:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy", "timestamp": "2026-03-22T10:30:00Z"}
```

## 🔌 Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **GET** | `/health` | Health check |
| **POST** | `/api/v1/chat/stream` | RAG streaming chat (SSE) |
| **POST** | `/api/v1/azure-chat/` | Azure direct chat |
| **POST** | `/api/v1/admin/ingest` | Full re-ingestion |
| **POST** | `/api/v1/admin/ingest/{page_id}` | Single page sync |
| **GET** | `/api/v1/admin/sync/status` | Sync status |
| **POST** | `/api/v1/webhook/bookstack` | BookStack webhook receiver |

## 📝 Example Chat Request

```bash
curl -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I reset my password?",
    "conversation_history": []
  }'
```

## 🧪 Run Tests

```bash
pytest
```

Or with coverage:

```bash
pytest --cov=app
```

## 🐳 Run with Docker (Optional)

```bash
docker build -t cleo-backend .
docker run -p 8000:8000 --env-file .env cleo-backend
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| `OPENAI_API_KEY not found` | Check `.env` file is in `backend/` directory |
| `Connection refused to Pinecone` | Verify `PINECONE_API_KEY` and network connectivity |
| `BookStack connection failed` | Verify `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET` |
| Port 8000 already in use | Use different port: `python main.py --port 8001` |

## 📊 Architecture

```
backend/
├── main.py                 # FastAPI app entry point
├── app/
│   ├── adapters/          # External service clients (BookStack, Pinecone, OpenAI)
│   ├── services/          # Business logic (RAG, Chat, Ingestion)
│   ├── api/               # Route handlers (chat, admin, webhook)
│   ├── core/              # Config, exceptions, prompts, logging
│   └── domain/            # Pydantic schemas (DTOs)
├── tests/                 # Unit + integration tests
└── requirements.txt       # Python dependencies
```

---

**Backend running?** ✅ Now run the frontend:

```bash
cd ../frontend
npm install
npm run dev
```

Frontend will be available at **http://localhost:3000**

