"""RAG service orchestrator."""

import time
from typing import List, AsyncGenerator, Set

from loguru import logger

from app.core.config import settings
from app.core.exceptions import NoContextFoundError
from app.domain.schemas import ChatResponse, VectorSearchResult, ConversationMessage
from app.adapters.embedding_client import EmbeddingClient, embedding_client as default_embedding_client
from app.adapters.vector_store import vector_store as default_vector_store
from app.adapters.llm_client import llm_client as default_llm_client
from app.services.citation_ranker import citation_ranker as default_citation_ranker
from app.services.azure_chat_service import azure_chat_service as default_azure_chat_service

SHORTCUT_RESPONSES = {
    "en": {
        "what is cleo": "CLEO (Contextual Learning & Enterprise Oracle) is a premium AI-driven workspace assistant designed to provide grounded, reliable answers from your documentation and knowledge base.",
        "what can cleo do": "I can analyze internal documentation, summarize guides, and provide grounded answers with citations. I also feature a 'Neural Link' voice mode.",
        "how to use cleo": "Type your question or use the speech mode for voice interactions."
    },
    "es": {
        "qué es cleo": "CLEO es un asistente de trabajo premium impulsado por IA, diseñado para proporcionar respuestas fundamentadas de tu base de conocimientos.",
        "qué puede hacer cleo": "Puedo analizar documentación interna, resumir guías técnicas y proporcionar respuestas con citas directas.",
        "cómo usar cleo": "Simplemente escribe tu pregunta o usa el modo de voz."
    }
}

class RAGService:
    """Orchestrates embedding, search, gating, and generation."""

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
        is_voice_mode: bool = False,
        vibe: str = "professional",
        local_time: str | None = None,
        location: str | None = None,
        interrupted_context: str | None = None,
    ) -> ChatResponse:
        """Returns grounded answer with citations."""
        rlog = logger.bind(request_id="sync")
        t_start = time.perf_counter()

        normalized_q = question.lower().strip().lstrip("¿¡").rstrip("?")
        if locale in SHORTCUT_RESPONSES and normalized_q in SHORTCUT_RESPONSES[locale]:
            return ChatResponse(
                answer=SHORTCUT_RESPONSES[locale][normalized_q],
                mode_used="shortcut",
                max_confidence=1.0
            )

        query_vector = await self.embedding_client.embed_text(question)
        results = await self.vector_store.query(
            vector=query_vector,
            top_k=self.top_k,
            filter_dict=self._build_user_filter(user_id),
        )
        
        if not results:
            raise NoContextFoundError(detail="No knowledge base data found.")

        relevant = self._filter_by_confidence(results)
        if not relevant:
            raise NoContextFoundError()

        context_docs = self._expand_to_full_documents(relevant)
        ranked_citations = self.citation_ranker.rank_citations(relevant)

        answer = await self.llm_client.generate(
            question=question,
            context_chunks=context_docs,
            history=history,
            is_voice_mode=is_voice_mode,
            vibe=vibe,
            local_time=local_time,
            location=location,
            interrupted_context=interrupted_context,
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
        is_voice_mode: bool = False,
        vibe: str = "professional",
        local_time: str | None = None,
        location: str | None = None,
        interrupted_context: str | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Yields tokens + final summary based on confidence routing."""
        rlog = logger.bind(request_id="stream")
        
        normalized_q = question.lower().strip().lstrip("¿¡").rstrip("?")
        if locale in SHORTCUT_RESPONSES and normalized_q in SHORTCUT_RESPONSES[locale]:
            for token in SHORTCUT_RESPONSES[locale][normalized_q].split(" "):
                yield {"type": "token", "content": token + " "}
            yield {"type": "done", "mode_used": "shortcut", "max_confidence": 1.0}
            return

        query_vector = await self.embedding_client.embed_text(question)
        results = await self.vector_store.query(
            vector=query_vector,
            top_k=self.top_k,
            filter_dict=self._build_user_filter(user_id),
        )
        max_confidence = max([r.score for r in results]) if results else 0.0
        
        # Confidence Routing
        if max_confidence >= self._high_confidence_threshold():
            relevant = self._filter_by_confidence(results)
            context_docs = self._expand_to_full_documents(relevant)
            ranked_citations = self.citation_ranker.rank_citations(relevant)

            async for token in self.llm_client.generate_stream(
                question=question,
                context_chunks=context_docs,
                history=history,
                is_voice_mode=is_voice_mode,
                vibe=vibe,
                local_time=local_time,
                location=location,
                interrupted_context=interrupted_context,
            ):
                yield {"type": "token", "content": token}

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
            relevant = self._filter_by_confidence(results)
            context_docs = self._expand_to_full_documents(relevant)
            ranked_citations = self.citation_ranker.rank_citations(relevant)

            async for token in self.llm_client.generate_stream(
                question=question,
                context_chunks=context_docs,
                history=history,
                is_voice_mode=is_voice_mode,
                vibe=vibe,
                local_time=local_time,
                location=location,
                interrupted_context=interrupted_context,
            ):
                yield {"type": "token", "content": token}

            yield {
                "type": "done",
                "primary_citations": [c.model_dump() for c in ranked_citations["primary"]],
                "secondary_citations": [c.model_dump() for c in ranked_citations["secondary"]],
                "all_citations": [c.model_dump() for c in ranked_citations["all_sources"]],
                "hidden_sources_count": ranked_citations["hidden_count"],
                "mode_used": "uncertain",
                "max_confidence": max_confidence,
                "what_i_found": [
                    {"page_title": r.page_title, "score": r.score, "source_url": r.source_url or r.bookstack_url} 
                    for r in results[:3]
                ]
            }

        else:
            persona_context = f"CURRENT_TIME: {local_time or 'Unknown'}\nCURRENT_LOCATION: {location or 'Unknown'}"
            system_prompt = f"""You are CLEO, an advanced AI assistant for Andino Global.
            
{persona_context}

STRICT RULES:
1. No specific documents found; use general intelligence.
2. Be natural, conversational, and respect time/location contexts.
3. If asked about creators, mention Project Vanguard."""

            async for chunk in self.azure_chat_service.stream_chat(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": question}],
                params=None,
                history=history,
            ):
                yield {"type": "token", "content": chunk}
                
            yield {"type": "done", "mode_used": "azure_fallback", "max_confidence": max_confidence}

    def _expand_to_full_documents(self, results: List[VectorSearchResult]) -> List[str]:
        """Extract full document text from vector metadata."""
        full_texts: List[str] = []
        seen_page_ids: Set[int] = set()

        for r in results:
            if r.page_id and r.page_id not in seen_page_ids:
                if hasattr(r, "full_doc_text") and r.full_doc_text:
                    full_texts.append(r.full_doc_text)
                    seen_page_ids.add(r.page_id)
        
        return full_texts if full_texts else [r.text for r in results]

    def _filter_by_confidence(self, results: List[VectorSearchResult]) -> List[VectorSearchResult]:
        return [r for r in results if r.score >= self.min_score]

    def _high_confidence_threshold(self) -> float:
        return self.min_score

    def _medium_confidence_threshold(self) -> float:
        return max(0.0, min(0.5, self.min_score - 0.1))

    def _build_user_filter(self, user_id: str | None) -> dict | None:
        if not user_id: return None
        return {"$or": [{"source_type": {"$ne": "user_upload"}}, {"user_id": {"$eq": user_id}}]}

rag_service = RAGService()
