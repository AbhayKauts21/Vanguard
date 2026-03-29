"""RAG service — query orchestrator with confidence gating.

Phase 8: structured logging at every pipeline step with request-id correlation.
"""

import time
from typing import List, AsyncGenerator, Set

from loguru import logger

from app.core.config import settings
from app.core.exceptions import NoContextFoundError
from app.domain.schemas import ChatResponse, VectorSearchResult, ConversationMessage
from app.adapters.embedding_client import (
    EmbeddingClient,
    embedding_client as default_embedding_client,
)
from app.adapters.vector_store import vector_store as default_vector_store
from app.adapters.llm_client import llm_client as default_llm_client
from app.services.citation_ranker import citation_ranker as default_citation_ranker
from app.services.azure_chat_service import azure_chat_service as default_azure_chat_service


SHORTCUT_RESPONSES = {
    "en": {
        "what is cleo": "CLEO (Contextual Learning & Enterprise Oracle) is a premium AI-driven workspace assistant designed to provide grounded, reliable answers from your documentation and knowledge base. I combine advanced LLM reasoning with precise retrieval to give you the exact information you need.",
        "what can cleo do": "I can analyze your internal documentation, summarize complex technical guides, help you debug code, and provide grounded answers with direct citations. I also feature a 'Neural Link' voice mode for hands-free intelligence when you're on the go.",
        "how to use cleo": "Simply type your question in the chat bar, for voice interactions use the speech mode."
    },
    "es": {
        "qué es cleo": "CLEO (Oráculo Contextual de Aprendizaje Empresarial) es un asistente de trabajo premium impulsado por IA, diseñado para proporcionar respuestas fundamentadas y confiables de tu documentación y base de conocimientos. Combino el razonamiento avanzado de LLM con una recuperación precisa para darte la información exacta que necesitas.",
        "que es cleo": "CLEO (Oráculo Contextual de Aprendizaje Empresarial) es un asistente de trabajo premium impulsado por IA, diseñado para proporcionar respuestas fundamentadas y confiables de tu documentación y base de conocimientos. Combino el razonamiento avanzado de LLM con una recuperación precisa para darte la información exacta que necesitas.",
        "qué puede hacer cleo": "Puedo analizar tu documentación interna, resumir guías técnicas complejas, ayudarte a depurar código y proporcionar respuestas fundamentadas con citas directas. También cuento con un modo de voz 'Enlace Neural' para inteligencia manos libres cuando estás en movimiento.",
        "que puede hacer cleo": "Puedo analizar tu documentación interna, resumir guías técnicas complejas, ayudarte a depurar código y proporcionar respuestas fundamentadas con citas directas. También cuento con un modo de voz 'Enlace Neural' para inteligencia manos libres cuando estás en movimiento.",
        "cómo usar cleo": "Simplemente escribe tu pregunta en la barra de chat, para interacciones de voz usa el modo de voz.",
        "como usar cleo": "Simplemente escribe tu pregunta en la barra de chat, para interacciones de voz usa el modo de voz."
    }
}


class RAGService:
    """Orchestrates the full RAG pipeline: embed → search → gate → generate (SRP)."""

    def __init__(
        self,
        *,
        embedding_client: EmbeddingClient = default_embedding_client,
        vector_store=default_vector_store,
        llm_client=default_llm_client,
        citation_ranker=default_citation_ranker,
        azure_chat_service=default_azure_chat_service,
    ) -> None:
        self.embedding_client = embedding_client
        self.vector_store = vector_store
        self.llm_client = llm_client
        self.citation_ranker = citation_ranker
        self.azure_chat_service = azure_chat_service
        self.min_score = settings.MIN_SIMILARITY_SCORE
        self.top_k = settings.TOP_K_RESULTS

    async def answer_query(
        self,
        question: str,
        history: List[ConversationMessage] | None = None,
        locale: str = "en",
        user_id: str | None = None,
    ) -> ChatResponse:
        """Full RAG pipeline — returns answer with citations."""
        rlog = logger.bind(request_id="sync")
        t_start = time.perf_counter()

        # 0. Check for hardcoded shortcuts (Performance bypass)
        normalized_q = question.lower().strip().lstrip("¿¡").rstrip("?")
        if locale in SHORTCUT_RESPONSES and normalized_q in SHORTCUT_RESPONSES[locale]:
            answer = SHORTCUT_RESPONSES[locale][normalized_q]
            rlog.info("rag.shortcut_triggered", query=normalized_q, locale=locale)
            return ChatResponse(
                answer=answer,
                primary_citations=[],
                secondary_citations=[],
                all_citations=[],
                hidden_sources_count=0,
                mode_used="shortcut",
                max_confidence=1.0
            )

        # 1. Embed the user's question
        t0 = time.perf_counter()
        query_vector = await self.embedding_client.embed_text(question)
        rlog.info("rag.embed_query", query_length=len(question), duration_ms=round((time.perf_counter() - t0) * 1000, 1))

        # 2. Similarity search in Pinecone
        t0 = time.perf_counter()
        results = await self.vector_store.query(
            vector=query_vector,
            top_k=self.top_k,
            filter_dict=self._build_user_filter(user_id),
        )
        max_score = max((r.score for r in results), default=0.0)
        rlog.info("rag.vector_search", top_k=self.top_k, results=len(results), max_score=round(max_score, 3), duration_ms=round((time.perf_counter() - t0) * 1000, 1))

        # E-002: Guard against empty knowledge base (no vectors ingested yet)
        if not results:
            rlog.warning("rag.empty_knowledge_base", query=question[:80])
            raise NoContextFoundError(
                detail="No knowledge base data found. Please run ingestion first."
            )

        # 4. Context Expansion: Load full documents from disk for retrieved chunks
        relevant = self._filter_by_confidence(results)
        rlog.info("rag.confidence_gate", passed=bool(relevant), threshold=self.min_score, top_score=round(max_score, 3))

        if not relevant:
            rlog.info("rag.no_context", query=question[:80])
            raise NoContextFoundError()

        # Build context from FULL documents
        context_docs = self._expand_to_full_documents(relevant)
        ranked_citations = self.citation_ranker.rank_citations(relevant)

        # 5. Generate answer using LLM
        t0 = time.perf_counter()
        answer = await self.llm_client.generate(
            question=question,
            context_chunks=context_docs,
            history=history,
        )
        gen_ms = round((time.perf_counter() - t0) * 1000, 1)
        total_ms = round((time.perf_counter() - t_start) * 1000, 1)

        rlog.info(
            "rag.generate_done",
            model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            chunks_used=len(relevant),
            top_score=round(relevant[0].score, 3),
            generation_ms=gen_ms,
            total_ms=total_ms,
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

    async def answer_query_stream(
        self,
        question: str,
        history: List[ConversationMessage] | None = None,
        locale: str = "en",
        user_id: str | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Streaming RAG pipeline — yields tokens + final summary dict based on confidence routing."""
        rlog = logger.bind(request_id="stream")
        t_start = time.perf_counter()

        # 0. Check for hardcoded shortcuts (Performance bypass)
        normalized_q = question.lower().strip().lstrip("¿¡").rstrip("?")
        if locale in SHORTCUT_RESPONSES and normalized_q in SHORTCUT_RESPONSES[locale]:
            answer = SHORTCUT_RESPONSES[locale][normalized_q]
            rlog.info("rag.shortcut_triggered", query=normalized_q, locale=locale)
            
            # Simulate streaming for consistent UI feel
            for token in answer.split(" "):
                yield {"type": "token", "content": token + " "}
                
            yield {
                "type": "done",
                "primary_citations": [],
                "secondary_citations": [],
                "all_citations": [],
                "hidden_sources_count": 0,
                "mode_used": "shortcut",
                "max_confidence": 1.0
            }
            return

        # 1. Embed and query
        t0 = time.perf_counter()
        query_vector = await self.embedding_client.embed_text(question)
        rlog.info("rag.embed_query", query_length=len(question), duration_ms=round((time.perf_counter() - t0) * 1000, 1))

        t0 = time.perf_counter()
        results = await self.vector_store.query(
            vector=query_vector,
            top_k=self.top_k,
            filter_dict=self._build_user_filter(user_id),
        )
        max_confidence = max([r.score for r in results]) if results else 0.0
        rlog.info("rag.vector_search", top_k=self.top_k, results=len(results), max_score=round(max_confidence, 3), duration_ms=round((time.perf_counter() - t0) * 1000, 1))
        
        # 2. Confidence Routing
        if max_confidence >= self._high_confidence_threshold():
            # 🟢 TIER 1: High Confidence -> Strict RAG
            rlog.info(
                "rag.confidence_route",
                tier="high",
                max_confidence=round(max_confidence, 3),
                threshold=round(self._high_confidence_threshold(), 3),
            )
            relevant = self._filter_by_confidence(results)
            context_docs = self._expand_to_full_documents(relevant)
            ranked_citations = self.citation_ranker.rank_citations(relevant)

            # Stream tokens
            t0 = time.perf_counter()
            token_count = 0
            token_stream = self.llm_client.generate_stream(
                question=question,
                context_chunks=context_docs,
                history=history,
            )
            async for token in token_stream:
                token_count += 1
                yield {"type": "token", "content": token}

            gen_ms = round((time.perf_counter() - t0) * 1000, 1)
            total_ms = round((time.perf_counter() - t_start) * 1000, 1)
            rlog.info("rag.stream_done", mode="rag", tokens=token_count, chunks_used=len(relevant), generation_ms=gen_ms, total_ms=total_ms)

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

        elif max_confidence >= self._medium_confidence_threshold():
            # 🟡 TIER 2: Medium Confidence -> Honest Uncertainty Disclaimer
            rlog.info(
                "rag.confidence_route",
                tier="medium",
                max_confidence=round(max_confidence, 3),
                threshold=round(self._medium_confidence_threshold(), 3),
            )
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
            rlog.info("rag.confidence_route", tier="low", max_confidence=round(max_confidence, 3), mode="azure_fallback")
            system_prompt = """You are CLEO, an AI assistant for Andino Global.
            
ABOUT ANDINO GLOBAL:
- Product: BookStack - Enterprise Documentation Platform
- Support: support@andino.com
- Features: Page versioning, role-based access, webhooks

This is a GENERAL KNOWLEDGE question not covered in our knowledge base.
Provide helpful, accurate information from your training data.
Do NOT make up details about our product features or policies."""

            token_stream = self.azure_chat_service.stream_chat(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": question}],
                params=None,
                history=history,
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

    def _expand_to_full_documents(self, results: List[VectorSearchResult]) -> List[str]:
        """Load the full original documentation chapters directly from Pinecone metadata."""
        full_texts: List[str] = []
        seen_page_ids: Set[int] = set()

        for r in results:
            if r.page_id and r.page_id not in seen_page_ids:
                # The 'full_doc_text' is stored in the metadata of every chunk
                # We need to access it from the raw metadata if it's not a first-class field in VectorSearchResult
                # In our case, the query adapter might not be passing it through yet, so we need to check VectorStore
                
                # Retrieve from VectorSearchResult (we'll ensure VectorStore passes it)
                if hasattr(r, "full_doc_text") and r.full_doc_text:
                    full_texts.append(r.full_doc_text)
                    seen_page_ids.add(r.page_id)
                    logger.debug(f"Expanded context: loaded full doc for page {r.page_id} from metadata")
        
        # Fallback: if metadata expansion fails, use the individual chunks
        if not full_texts:
            return [r.text for r in results]
            
        return full_texts

    def _filter_by_confidence(
        self, results: List[VectorSearchResult]
    ) -> List[VectorSearchResult]:
        """Only keep results above the minimum similarity threshold."""
        return [r for r in results if r.score >= self.min_score]

    def _high_confidence_threshold(self) -> float:
        """Primary docs-grounding threshold, configurable per environment."""
        return self.min_score

    def _medium_confidence_threshold(self) -> float:
        """Fallback threshold for uncertain-but-related questions."""
        return max(0.0, min(0.5, self.min_score - 0.1))

    def _build_user_filter(self, user_id: str | None) -> dict | None:
        if not user_id:
            return None
        return {
            "$or": [
                {"source_type": {"$ne": "user_upload"}},
                {"user_id": {"$eq": user_id}},
            ]
        }


# Singleton instance
rag_service = RAGService()
