import pytest

from app.domain.schemas import VectorSearchResult
from app.services.rag_service import RAGService


class FakeEmbeddingClient:
    async def embed_text(self, question: str):
        return [0.1, 0.2, 0.3]


class FakeVectorStore:
    def __init__(self, results):
        self._results = results
        self.last_filter = None

    async def query(self, *, vector, top_k, filter_dict=None):
        self.last_filter = filter_dict
        return self._results


class FakeLLMClient:
    async def generate_stream(self, **kwargs):
        yield "Use "
        yield "Forgot Password."


class FakeCitationRanker:
    def rank_citations(self, results):
        return {
            "primary": [],
            "secondary": [],
            "all_sources": [],
            "hidden_count": 0,
        }


class FailAzureChatService:
    async def stream_chat(self, *args, **kwargs):
        raise AssertionError("Azure fallback should not be used for high-confidence docs mode")


@pytest.mark.asyncio
async def test_streaming_rag_uses_configured_similarity_threshold_for_docs_mode():
    results = [
        VectorSearchResult(
            chunk_id="page_9001_chunk_0",
            score=0.497,
            text="To reset a password, click Forgot Password and follow the secure email link.",
            page_id=9001,
            page_title="Password Reset Guide",
            bookstack_url="https://demo.cleo.local/books/501/page/password-reset-guide",
            book_id=501,
        )
    ]

    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(results),
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=FailAzureChatService(),
    )
    service.min_score = 0.45

    events = []
    async for event in service.answer_query_stream("How do I reset my password?"):
        events.append(event)

    assert events[0] == {"type": "token", "content": "Use "}
    assert events[1] == {"type": "token", "content": "Forgot Password."}
    assert events[-1]["type"] == "done"
    assert events[-1]["mode_used"] == "rag"
    assert events[-1]["max_confidence"] == pytest.approx(0.497)


@pytest.mark.asyncio
async def test_rag_filters_user_uploads_to_current_user():
    store = FakeVectorStore([])
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=store,
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=FailAzureChatService(),
    )

    with pytest.raises(Exception):
        await service.answer_query("what is sso", user_id="user-123")

    assert store.last_filter == {
        "$or": [
            {"source_type": {"$ne": "user_upload"}},
            {"user_id": {"$eq": "user-123"}},
        ]
    }
