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
from app.services.azure_chat_service import azure_chat_service


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
            hidden_sources_count=ranked_citations["hidden_count"],
            mode_used="rag",
            max_confidence=relevant[0].score if relevant else 0.0
        )

    async def answer_query_stream(self, question: str) -> AsyncGenerator[dict, None]:
        """Streaming RAG pipeline — yields tokens + final summary dict based on confidence routing."""
        # 1. Embed and query
        query_vector = await embedding_client.embed_text(question)
        results = await vector_store.query(vector=query_vector, top_k=self.top_k)

        max_confidence = max([r.score for r in results]) if results else 0.0
        
        # 2. Confidence Routing
        if max_confidence >= 0.78:
            # 🟢 TIER 1: High Confidence -> Strict RAG
            relevant = self._filter_by_confidence(results)
            context_chunks = [r.text for r in relevant]
            ranked_citations = citation_ranker.rank_citations(relevant)

            # Stream tokens
            token_stream = llm_client.generate_stream(
                question=question,
                context_chunks=context_chunks,
            )
            async for token in token_stream:
                yield {"type": "token", "content": token}
                
            # Yield final done event with citations
            yield {
                "type": "done",
                "primary_citations": [c.model_dump() for c in ranked_citations["primary"]],
                "secondary_citations": [c.model_dump() for c in ranked_citations["secondary"]],
                "all_citations": [c.model_dump() for c in ranked_citations["all_sources"]],
                "hidden_sources_count": ranked_citations["hidden_count"],
                "mode_used": "rag",
                "max_confidence": max_confidence
            }

        elif max_confidence >= 0.50:
            # 🟡 TIER 2: Medium Confidence -> Honest Uncertainty Disclaimer
            uncertainty_message = (
                "I'm not fully confident in my answer to this question.\n\n"
                "The question seems to be about our product or policies, "
                "but I don't have clear documentation on it.\n\n"
                "For accurate details, please contact: support@andino.com"
            )
            
            yield {"type": "token", "content": uncertainty_message}
            
            what_i_found = [
                {"page_title": r.page_title, "score": r.score} for r in results[:3]
            ]
            
            yield {
                "type": "done",
                "primary_citations": [],
                "secondary_citations": [],
                "all_citations": [],
                "hidden_sources_count": 0,
                "mode_used": "uncertain",
                "max_confidence": max_confidence,
                "what_i_found": what_i_found
            }

        else:
            # 🔴 TIER 3: Low Confidence -> Azure General Knowledge
            system_prompt = """You are CLEO, an AI assistant for Andino Global.
            
ABOUT ANDINO GLOBAL:
- Product: BookStack - Enterprise Documentation Platform
- Support: support@andino.com
- Features: Page versioning, role-based access, webhooks

This is a GENERAL KNOWLEDGE question not covered in our knowledge base.
Provide helpful, accurate information from your training data.
Do NOT make up details about our product features or policies."""

            token_stream = azure_chat_service.stream_chat(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": question}],
                params=None
            )
            
            async for chunk in token_stream:
                # azure_chat_service.stream_chat returns string chunks
                yield {"type": "token", "content": chunk}
                
            yield {
                "type": "done",
                "primary_citations": [],
                "secondary_citations": [],
                "all_citations": [],
                "hidden_sources_count": 0,
                "mode_used": "azure_fallback",
                "max_confidence": max_confidence
            }

    def _filter_by_confidence(
        self, results: List[VectorSearchResult]
    ) -> List[VectorSearchResult]:
        """Only keep results above the minimum similarity threshold."""
        return [r for r in results if r.score >= self.min_score]


# Singleton instance
rag_service = RAGService()
