"""RAG service — query orchestrator with confidence gating."""

from typing import List, AsyncGenerator

from loguru import logger

from app.core.config import settings
from app.core.exceptions import NoContextFoundError
from app.core.prompts import NO_CONTEXT_RESPONSE
from app.domain.schemas import ChatResponse, Citation, VectorSearchResult
from app.adapters.embedding_client import embedding_client
from app.adapters.vector_store import vector_store
from app.adapters.llm_client import llm_client
from app.services.citation_ranker import citation_ranker


class RAGService:
    """Orchestrates the full RAG pipeline: embed → search → gate → generate (SRP)."""

    def __init__(self) -> None:
        self.min_score = settings.MIN_SIMILARITY_SCORE
        self.top_k = settings.TOP_K_RESULTS

    async def answer_query(self, question: str) -> ChatResponse:
        """Full RAG pipeline — returns answer with citations."""
        # 1. Embed the user's question
        query_vector = await embedding_client.embed_text(question)

        # 2. Similarity search in Pinecone
        results = await vector_store.query(vector=query_vector, top_k=self.top_k)

        # E-002: Guard against empty knowledge base (no vectors ingested yet)
        if not results:
            logger.warning(f"Empty knowledge base — no vectors found for: '{question[:80]}...'")
            raise NoContextFoundError(
                detail="No knowledge base data found. Please run ingestion first."
            )

        # 3. Confidence gate — reject if no relevant context
        relevant = self._filter_by_confidence(results)
        if not relevant:
            logger.info(f"No context found for: '{question[:80]}...'")
            raise NoContextFoundError()

        # 4. Build context from top chunks
        context_chunks = [r.text for r in relevant]
        ranked_citations = citation_ranker.rank_citations(relevant)

        # 5. Generate answer using LLM
        answer = await llm_client.generate(
            question=question,
            context_chunks=context_chunks,
        )

        logger.info(
            f"RAG response: {len(relevant)} chunks, "
            f"top_score={relevant[0].score:.3f}"
        )

        return ChatResponse(
            answer=answer, 
            primary_citations=ranked_citations["primary"],
            secondary_citations=ranked_citations["secondary"],
            all_citations=ranked_citations["all_sources"],
            hidden_sources_count=ranked_citations["hidden_count"]
        )

    async def answer_query_stream(self, question: str):
        """Streaming RAG pipeline — yields tokens + returns citations."""
        # 1–3: Same retrieval + gating
        query_vector = await embedding_client.embed_text(question)
        results = await vector_store.query(vector=query_vector, top_k=self.top_k)

        # E-002: Guard against empty knowledge base
        if not results:
            logger.warning(f"Empty knowledge base — no vectors found for: '{question[:80]}...'")
            raise NoContextFoundError(
                detail="No knowledge base data found. Please run ingestion first."
            )

        relevant = self._filter_by_confidence(results)
        if not relevant:
            raise NoContextFoundError()

        context_chunks = [r.text for r in relevant]
        ranked_citations = citation_ranker.rank_citations(relevant)

        # 4. Stream tokens from LLM
        return llm_client.generate_stream(
            question=question,
            context_chunks=context_chunks,
        ), ranked_citations

    def _filter_by_confidence(
        self, results: List[VectorSearchResult]
    ) -> List[VectorSearchResult]:
        """Only keep results above the minimum similarity threshold."""
        return [r for r in results if r.score >= self.min_score]


# Singleton instance
rag_service = RAGService()
