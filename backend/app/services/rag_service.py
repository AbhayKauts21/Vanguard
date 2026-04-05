"""RAG service — query orchestrator with confidence gating."""

from __future__ import annotations

import time
from typing import AsyncGenerator, List, Sequence, Set

from loguru import logger

from app.adapters.embedding_client import (
    EmbeddingClient,
    embedding_client as default_embedding_client,
)
from app.adapters.llm_client import llm_client as default_llm_client
from app.adapters.vector_store import vector_store as default_vector_store
from app.core.config import settings
from app.domain.schemas import ChatResponse, VectorSearchResult, ConversationMessage
from app.services.azure_chat_service import azure_chat_service as default_azure_chat_service
from app.services.citation_ranker import citation_ranker as default_citation_ranker
from app.services.query_intent_service import (
    QueryIntent,
    query_intent_service as default_query_intent_service,
)


SHORTCUT_RESPONSES = {
    "en": {
        "what is cleo": "CLEO (Contextual Learning & Enterprise Oracle) is a premium AI-driven workspace assistant designed to provide grounded, reliable answers from your documentation and knowledge base. I combine advanced LLM reasoning with precise retrieval to give you the exact information you need.",
        "what can cleo do": "I can analyze your internal documentation, summarize complex technical guides, help you debug code, and provide grounded answers with direct citations. I also feature a 'Neural Link' voice mode for hands-free intelligence when you're on the go.",
        "how to use cleo": "Simply type your question in the chat bar, for voice interactions use the speech mode.",
        "hi": "Hi. I'm CLEO. I can help with grounded questions from your documentation, and I can also handle general chat when a question isn't documentation-driven.",
        "hello": "Hello. I'm CLEO. I can help with grounded questions from your documentation, and I can also handle general chat when a question isn't documentation-driven.",
        "hey": "Hey. I'm CLEO. Ask me about your docs, product workflows, or a general question and I'll route it the right way.",
        "how are you": "I'm doing well and ready to help. You can ask about your documentation, product workflows, or general questions.",
        "thanks": "You're welcome. If you want, ask another documentation question or any general follow-up.",
        "thank you": "You're welcome. If you want, ask another documentation question or any general follow-up.",
    },
    "es": {
        "qué es cleo": "CLEO (Oráculo Contextual de Aprendizaje Empresarial) es un asistente de trabajo premium impulsado por IA, diseñado para proporcionar respuestas fundamentadas y confiables de tu documentación y base de conocimientos. Combino el razonamiento avanzado de LLM con una recuperación precisa para darte la información exacta que necesitas.",
        "que es cleo": "CLEO (Oráculo Contextual de Aprendizaje Empresarial) es un asistente de trabajo premium impulsado por IA, diseñado para proporcionar respuestas fundamentadas y confiables de tu documentación y base de conocimientos. Combino el razonamiento avanzado de LLM con una recuperación precisa para darte la información exacta que necesitas.",
        "qué puede hacer cleo": "Puedo analizar tu documentación interna, resumir guías técnicas complejas, ayudarte a depurar código y proporcionar respuestas fundamentadas con citas directas. También cuento con un modo de voz 'Enlace Neural' para inteligencia manos libres cuando estás en movimiento.",
        "que puede hacer cleo": "Puedo analizar tu documentación interna, resumir guías técnicas complejas, ayudarte a depurar código y proporcionar respuestas fundamentadas con citas directas. También cuento con un modo de voz 'Enlace Neural' para inteligencia manos libres cuando estás en movimiento.",
        "cómo usar cleo": "Simplemente escribe tu pregunta en la barra de chat, para interacciones de voz usa el modo de voz.",
        "como usar cleo": "Simplemente escribe tu pregunta en la barra de chat, para interacciones de voz usa el modo de voz.",
        "hola": "Hola. Soy CLEO. Puedo ayudarte con preguntas fundamentadas en tu documentación y también con conversación general cuando no dependa de documentos internos.",
        "gracias": "De nada. Si quieres, haz otra pregunta sobre la documentación o una consulta general.",
        "cómo estás": "Estoy bien y lista para ayudar. Puedes preguntarme sobre tu documentación, flujos del producto o temas generales.",
        "como estas": "Estoy bien y lista para ayudar. Puedes preguntarme sobre tu documentación, flujos del producto o temas generales.",
    },
}

UNCERTAINTY_RESPONSES = {
    "en": (
        "I'm not fully confident in my answer to this question.\n\n"
        "The question seems related to our product or policies, but I don't have clear documentation for it.\n\n"
        "For accurate details, please contact: support@andino.com"
    ),
    "es": (
        "No tengo la confianza suficiente para responder esta pregunta con precisión.\n\n"
        "La consulta parece relacionada con nuestro producto o políticas, pero no tengo documentación clara para respaldarla.\n\n"
        "Para obtener detalles correctos, por favor contacta a: support@andino.com"
    ),
}

FALLBACK_FAILURE_RESPONSES = {
    "en": "I ran into a temporary response issue. Please try again.",
    "es": "Tuve un problema temporal al generar la respuesta. Inténtalo de nuevo.",
}


class RAGService:
    """Orchestrates retrieval, routing, and generation."""

    def __init__(
        self,
        *,
        embedding_client: EmbeddingClient = default_embedding_client,
        vector_store=default_vector_store,
        llm_client=default_llm_client,
        citation_ranker=default_citation_ranker,
        azure_chat_service=default_azure_chat_service,
        query_intent_service=default_query_intent_service,
    ) -> None:
        self.embedding_client = embedding_client
        self.vector_store = vector_store
        self.llm_client = llm_client
        self.citation_ranker = citation_ranker
        self.azure_chat_service = azure_chat_service
        self.query_intent_service = query_intent_service
        self.min_score = settings.MIN_SIMILARITY_SCORE
        self.top_k = settings.TOP_K_RESULTS

    async def answer_query(
        self,
        question: str,
        history: List[ConversationMessage] | None = None,
        locale: str = "en",
        user_id: str | None = None,
    ) -> ChatResponse:
        """Return a single answer after routing between docs and general chat."""
        rlog = logger.bind(request_id="sync")
        t_start = time.perf_counter()

        results, max_confidence = await self._search_results(
            question,
            user_id=user_id,
            rlog=rlog,
        )

        response = await self._answer_docs_sync(
            question=question,
            history=history,
            locale=locale,
            results=results,
            max_confidence=max_confidence,
            rlog=rlog,
            t_start=t_start,
        )
        return response

    async def answer_query_stream(
        self,
        question: str,
        history: List[ConversationMessage] | None = None,
        locale: str = "en",
        user_id: str | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Streaming RAG pipeline with intent-aware routing."""
        rlog = logger.bind(request_id="stream")
        t_start = time.perf_counter()

        results, max_confidence = await self._search_results(
            question,
            user_id=user_id,
            rlog=rlog,
        )

        if max_confidence >= self._high_confidence_threshold():
            rlog.info(
                "rag.confidence_route",
                tier="high",
                max_confidence=round(max_confidence, 3),
                threshold=round(self._high_confidence_threshold(), 3),
            )
            relevant = self._filter_by_confidence(results)
            context_docs = self._expand_to_full_documents(relevant)
            ranked_citations = self.citation_ranker.rank_citations(relevant)

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
            rlog.info(
                "rag.stream_done",
                mode="rag",
                tokens=token_count,
                chunks_used=len(relevant),
                generation_ms=gen_ms,
                total_ms=total_ms,
            )

            yield {
                "type": "done",
                "primary_citations": [c.model_dump() for c in ranked_citations["primary"]],
                "secondary_citations": [c.model_dump() for c in ranked_citations["secondary"]],
                "all_citations": [c.model_dump() for c in ranked_citations["all_sources"]],
                "hidden_sources_count": ranked_citations["hidden_count"],
                "mode_used": "rag",
                "max_confidence": max_confidence,
            }
            return

        intent = await self.query_intent_service.classify(
            question,
            history=history,
            locale=locale,
        )
        rlog.info(
            "rag.intent_route",
            intent=intent,
            locale=locale,
            stage="post_retrieval",
        )

        if max_confidence >= self._medium_confidence_threshold() and intent == "docs":
            rlog.info(
                "rag.confidence_route",
                tier="medium",
                max_confidence=round(max_confidence, 3),
                threshold=round(self._medium_confidence_threshold(), 3),
            )
            uncertainty_message = self._uncertainty_message(locale)
            yield {"type": "token", "content": uncertainty_message}
            yield {
                "type": "done",
                "primary_citations": [],
                "secondary_citations": [],
                "all_citations": [],
                "hidden_sources_count": 0,
                "mode_used": "uncertain",
                "max_confidence": max_confidence,
                "what_i_found": self._what_i_found(results),
            }
            return

        if max_confidence >= self._medium_confidence_threshold():
            rlog.info(
                "rag.confidence_route",
                tier="medium_non_docs_fallback",
                max_confidence=round(max_confidence, 3),
                threshold=round(self._medium_confidence_threshold(), 3),
                intent=intent,
            )
        else:
            rlog.info(
                "rag.confidence_route",
                tier="low",
                max_confidence=round(max_confidence, 3),
                mode="azure_fallback",
                intent=intent,
            )

        async for event in self._stream_non_docs_response(
            question=question,
            history=history,
            locale=locale,
            intent=intent,
            max_confidence=max_confidence,
        ):
            yield event

    async def _search_results(
        self,
        question: str,
        *,
        user_id: str | None,
        rlog,
    ) -> tuple[List[VectorSearchResult], float]:
        t0 = time.perf_counter()
        query_vector = await self.embedding_client.embed_text(question)
        rlog.info(
            "rag.embed_query",
            query_length=len(question),
            duration_ms=round((time.perf_counter() - t0) * 1000, 1),
        )

        t0 = time.perf_counter()
        results = await self.vector_store.query(
            vector=query_vector,
            top_k=self.top_k,
            filter_dict=self._build_user_filter(user_id),
        )
        max_confidence = max((r.score for r in results), default=0.0)
        rlog.info(
            "rag.vector_search",
            top_k=self.top_k,
            results=len(results),
            max_score=round(max_confidence, 3),
            duration_ms=round((time.perf_counter() - t0) * 1000, 1),
        )
        return results, max_confidence

    async def _answer_docs_sync(
        self,
        *,
        question: str,
        history: Sequence[ConversationMessage] | None,
        locale: str,
        results: List[VectorSearchResult],
        max_confidence: float,
        rlog,
        t_start: float,
    ) -> ChatResponse:
        if max_confidence >= self._high_confidence_threshold():
            relevant = self._filter_by_confidence(results)
            context_docs = self._expand_to_full_documents(relevant)
            ranked_citations = self.citation_ranker.rank_citations(relevant)

            t0 = time.perf_counter()
            answer = await self.llm_client.generate(
                question=question,
                context_chunks=context_docs,
                history=list(history) if history else None,
            )
            gen_ms = round((time.perf_counter() - t0) * 1000, 1)
            total_ms = round((time.perf_counter() - t_start) * 1000, 1)

            rlog.info(
                "rag.generate_done",
                model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
                chunks_used=len(relevant),
                top_score=round(relevant[0].score, 3) if relevant else 0.0,
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
                max_confidence=max_confidence,
            )

        intent = await self.query_intent_service.classify(
            question,
            history=history,
            locale=locale,
        )
        rlog.info(
            "rag.intent_route",
            intent=intent,
            locale=locale,
            stage="post_retrieval",
        )

        if max_confidence >= self._medium_confidence_threshold() and intent == "docs":
            return ChatResponse(
                answer=self._uncertainty_message(locale),
                primary_citations=[],
                secondary_citations=[],
                all_citations=[],
                hidden_sources_count=0,
                mode_used="uncertain",
                max_confidence=max_confidence,
                what_i_found=self._what_i_found(results),
            )

        return await self._complete_non_docs_response(
            question=question,
            history=history,
            locale=locale,
            intent=intent,
            max_confidence=max_confidence,
        )

    async def _complete_non_docs_response(
        self,
        *,
        question: str,
        history: Sequence[ConversationMessage] | None,
        locale: str,
        intent: QueryIntent,
        max_confidence: float,
    ) -> ChatResponse:
        system_prompt = self._fallback_system_prompt(locale=locale, intent=intent)
        try:
            answer = await self.azure_chat_service.complete_chat(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": question}],
                params=None,
                history=list(history) if history else None,
            )
            answer = answer.strip() or self._fallback_failure_message(locale)
        except Exception as exc:
            logger.warning(
                "rag.azure_fallback_failed",
                intent=intent,
                locale=locale,
                error=str(exc),
            )
            answer = self._fallback_failure_message(locale)

        return ChatResponse(
            answer=answer,
            primary_citations=[],
            secondary_citations=[],
            all_citations=[],
            hidden_sources_count=0,
            mode_used="azure_fallback",
            max_confidence=max_confidence,
        )

    async def _stream_non_docs_response(
        self,
        *,
        question: str,
        history: Sequence[ConversationMessage] | None,
        locale: str,
        intent: QueryIntent,
        max_confidence: float,
    ) -> AsyncGenerator[dict, None]:
        system_prompt = self._fallback_system_prompt(locale=locale, intent=intent)
        try:
            token_stream = self.azure_chat_service.stream_chat(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": question}],
                params=None,
                history=list(history) if history else None,
            )
            async for chunk in token_stream:
                yield {"type": "token", "content": chunk}
        except Exception as exc:
            logger.warning(
                "rag.azure_fallback_failed",
                intent=intent,
                locale=locale,
                error=str(exc),
            )
            yield {"type": "token", "content": self._fallback_failure_message(locale)}

        yield {
            "type": "done",
            "primary_citations": [],
            "secondary_citations": [],
            "all_citations": [],
            "hidden_sources_count": 0,
            "mode_used": "azure_fallback",
            "max_confidence": max_confidence,
        }

    async def _stream_shortcut(self, answer: str) -> AsyncGenerator[dict, None]:
        for token in answer.split(" "):
            yield {"type": "token", "content": token + " "}
        yield {
            "type": "done",
            "primary_citations": [],
            "secondary_citations": [],
            "all_citations": [],
            "hidden_sources_count": 0,
            "mode_used": "shortcut",
            "max_confidence": 1.0,
        }

    def _shortcut_chat_response(self, answer: str) -> ChatResponse:
        return ChatResponse(
            answer=answer,
            primary_citations=[],
            secondary_citations=[],
            all_citations=[],
            hidden_sources_count=0,
            mode_used="shortcut",
            max_confidence=1.0,
        )

    def _shortcut_response(self, question: str, locale: str) -> str | None:
        normalized_q = self._normalize_query(question)
        localized = SHORTCUT_RESPONSES.get(locale, {})
        if normalized_q in localized:
            return localized[normalized_q]
        fallback = SHORTCUT_RESPONSES.get("en", {})
        return fallback.get(normalized_q)

    def _normalize_query(self, question: str) -> str:
        return " ".join(question.lower().strip().split()).lstrip("¿¡").rstrip("?.! ")

    def _uncertainty_message(self, locale: str) -> str:
        return UNCERTAINTY_RESPONSES.get(locale, UNCERTAINTY_RESPONSES["en"])

    def _fallback_failure_message(self, locale: str) -> str:
        return FALLBACK_FAILURE_RESPONSES.get(locale, FALLBACK_FAILURE_RESPONSES["en"])

    def _what_i_found(self, results: Sequence[VectorSearchResult]) -> list[dict]:
        return [
            {
                "page_title": r.page_title,
                "score": r.score,
                "source_url": r.source_url or r.bookstack_url,
            }
            for r in results[:3]
        ]

    def _fallback_system_prompt(self, *, locale: str, intent: QueryIntent) -> str:
        language_instruction = (
            "Reply in Spanish."
            if locale.lower().startswith("es")
            else "Reply in English."
        )

        if intent == "smalltalk":
            intent_instruction = (
                "The user is making small talk or greeting you. Respond warmly, naturally, and briefly. "
                "Do not mention the knowledge base or missing documentation unless the user asks about it."
            )
        elif intent == "general":
            intent_instruction = (
                "The user asked a general knowledge or open-domain question that does not need internal documentation. "
                "Answer helpfully and directly using general knowledge. Do not pretend the answer is grounded in company docs."
            )
        else:
            intent_instruction = (
                "The user likely asked about company or product documentation, but retrieval did not provide reliable support. "
                "Be explicit that you do not have enough source-backed documentation for a confident product-specific answer. "
                "You may provide cautious general guidance, but do not invent Andino, CLEO, or product-specific facts, policies, or procedures."
            )

        return (
            "You are CLEO, a helpful AI assistant for Andino Global. "
            f"{language_instruction} "
            f"{intent_instruction} "
            "Keep the reply concise, clear, and conversational."
        )

    def _expand_to_full_documents(self, results: List[VectorSearchResult]) -> List[str]:
        """Load the full original documentation chapters directly from Pinecone metadata."""
        full_texts: List[str] = []
        seen_page_ids: Set[int] = set()

        for r in results:
            if r.page_id and r.page_id not in seen_page_ids:
                if hasattr(r, "full_doc_text") and r.full_doc_text:
                    full_texts.append(r.full_doc_text)
                    seen_page_ids.add(r.page_id)
                    logger.debug(f"Expanded context: loaded full doc for page {r.page_id} from metadata")

        if not full_texts:
            return [r.text for r in results]

        return full_texts

    def _filter_by_confidence(self, results: List[VectorSearchResult]) -> List[VectorSearchResult]:
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


rag_service = RAGService()
