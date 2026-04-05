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
        self.query_count = 0

    async def query(self, *, vector, top_k, filter_dict=None):
        self.query_count += 1
        self.last_filter = filter_dict
        return self._results


class FakeLLMClient:
    def __init__(self):
        self.generate_calls = 0

    async def generate(self, **kwargs):
        self.generate_calls += 1
        return "Use Forgot Password."

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


class FakeIntentService:
    def __init__(self, label="docs"):
        self.label = label
        self.calls = 0

    async def classify(self, question, *, history=None, locale="en"):
        self.calls += 1
        return self.label


class FakeAzureChatService:
    def __init__(self, *, complete_text="general answer", stream_chunks=None):
        self.complete_text = complete_text
        self.stream_chunks = stream_chunks or ["general ", "answer"]
        self.complete_calls = 0
        self.stream_calls = 0

    async def complete_chat(self, *args, **kwargs):
        self.complete_calls += 1
        return self.complete_text

    async def stream_chat(self, *args, **kwargs):
        self.stream_calls += 1
        for chunk in self.stream_chunks:
            yield chunk


class FailAzureChatService:
    async def complete_chat(self, *args, **kwargs):
        raise AssertionError("Azure fallback should not be used for this path")

    async def stream_chat(self, *args, **kwargs):
        raise AssertionError("Azure fallback should not be used for this path")


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
        query_intent_service=FakeIntentService("docs"),
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
async def test_greeting_queries_still_search_before_low_confidence_fallback():
    store = FakeVectorStore([])
    intent_service = FakeIntentService("smalltalk")
    azure = FakeAzureChatService(complete_text="Hello there.")
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=store,
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=azure,
        query_intent_service=intent_service,
    )

    response = await service.answer_query("hello")

    assert response.mode_used == "azure_fallback"
    assert response.answer == "Hello there."
    assert store.query_count == 1
    assert intent_service.calls == 1
    assert azure.complete_calls == 1


@pytest.mark.asyncio
async def test_general_queries_search_first_then_fallback_sync():
    store = FakeVectorStore(
        [
            VectorSearchResult(
                chunk_id="page_1_chunk_0",
                score=0.18,
                text="This should never be used.",
                page_id=1,
            )
        ]
    )
    azure = FakeAzureChatService(complete_text="Paris is the capital of France.")
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=store,
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=azure,
        query_intent_service=FakeIntentService("general"),
    )

    response = await service.answer_query("What is the capital of France?")

    assert response.mode_used == "azure_fallback"
    assert response.answer == "Paris is the capital of France."
    assert response.max_confidence == pytest.approx(0.18)
    assert store.query_count == 1
    assert azure.complete_calls == 1


@pytest.mark.asyncio
async def test_sync_medium_confidence_smalltalk_uses_azure_fallback():
    results = [
        VectorSearchResult(
            chunk_id="page_1_chunk_0",
            score=0.26,
            text="Loosely related content.",
            page_id=1,
            page_title="User Guide",
        )
    ]
    azure = FakeAzureChatService(complete_text="Hello there.")
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(results),
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=azure,
        query_intent_service=FakeIntentService("smalltalk"),
    )
    service.min_score = 0.35

    response = await service.answer_query("hello")

    assert response.mode_used == "azure_fallback"
    assert response.answer == "Hello there."
    assert response.max_confidence == pytest.approx(0.26)
    assert azure.complete_calls == 1


@pytest.mark.asyncio
async def test_sync_medium_confidence_returns_uncertain_instead_of_rag():
    results = [
        VectorSearchResult(
            chunk_id="page_9001_chunk_0",
            score=0.44,
            text="Possibly related product content.",
            page_id=9001,
            page_title="Account Settings",
            bookstack_url="https://demo.cleo.local/books/501/page/account-settings",
            book_id=501,
        )
    ]
    llm = FakeLLMClient()
    azure = FailAzureChatService()
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(results),
        llm_client=llm,
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=azure,
        query_intent_service=FakeIntentService("docs"),
    )
    service.min_score = 0.5

    response = await service.answer_query("What is the refund policy?")

    assert response.mode_used == "uncertain"
    assert "not fully confident" in response.answer.lower()
    assert response.max_confidence == pytest.approx(0.44)
    assert llm.generate_calls == 0


@pytest.mark.asyncio
async def test_stream_medium_confidence_general_uses_azure_fallback():
    results = [
        VectorSearchResult(
            chunk_id="page_3_chunk_0",
            score=0.27,
            text="Weakly related content.",
            page_id=3,
        )
    ]
    azure = FakeAzureChatService(stream_chunks=["Hello ", "there."])
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(results),
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=azure,
        query_intent_service=FakeIntentService("general"),
    )
    service.min_score = 0.35

    events = []
    async for event in service.answer_query_stream("hello"):
        events.append(event)

    assert events[0] == {"type": "token", "content": "Hello "}
    assert events[1] == {"type": "token", "content": "there."}
    assert events[-1]["mode_used"] == "azure_fallback"
    assert events[-1]["max_confidence"] == pytest.approx(0.27)
    assert azure.stream_calls == 1


@pytest.mark.asyncio
async def test_sync_low_confidence_docs_query_uses_azure_fallback():
    results = [
        VectorSearchResult(
            chunk_id="page_2_chunk_0",
            score=0.18,
            text="Barely related chunk.",
            page_id=2,
        )
    ]
    azure = FakeAzureChatService(
        complete_text="I don't have enough source-backed documentation to answer that confidently."
    )
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=FakeVectorStore(results),
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=azure,
        query_intent_service=FakeIntentService("docs"),
    )

    response = await service.answer_query("Does CLEO support SSO?")

    assert response.mode_used == "azure_fallback"
    assert "source-backed" in response.answer
    assert response.max_confidence == pytest.approx(0.18)
    assert azure.complete_calls == 1


@pytest.mark.asyncio
async def test_rag_filters_user_uploads_to_current_user():
    store = FakeVectorStore([])
    service = RAGService(
        embedding_client=FakeEmbeddingClient(),
        vector_store=store,
        llm_client=FakeLLMClient(),
        citation_ranker=FakeCitationRanker(),
        azure_chat_service=FakeAzureChatService(),
        query_intent_service=FakeIntentService("docs"),
    )

    await service.answer_query("How do I use my uploaded PDF?", user_id="user-123")

    assert store.last_filter == {
        "$or": [
            {"source_type": {"$ne": "user_upload"}},
            {"user_id": {"$eq": "user-123"}},
        ]
    }
