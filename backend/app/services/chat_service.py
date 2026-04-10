from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncGenerator
from uuid import UUID

from loguru import logger

from app.core.exceptions import ResourceNotFoundError
from app.core.prompts import NO_CONTEXT_RESPONSE
from app.db.models import ChatMessageRecord, ChatSession, User
from app.domain.schemas import (
    ChatCreateRequest,
    ChatListResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatMessageSender,
    ChatMessagesResponse,
    ChatResponse,
    ChatSendResponse,
    ChatSummaryResponse,
    Citation,
    ConversationMessage,
)
from app.repositories.chat_repository import chat_repository
from app.services.rag_service import rag_service as default_rag_service
from app.services.audit_service import audit_service
from app.services.voice_conversation_service import (
    voice_conversation_service as default_voice_conversation_service,
)
from app.services.tts_service import tts_service as default_tts_service
from app.domain.audit_log import AuditEventCode


@dataclass
class PreparedVoiceTurn:
    response: ChatResponse
    voice_audio_bytes: bytes
    voice_audio_content_type: str


class ChatService:
    def __init__(
        self,
        *,
        rag_service=default_rag_service,
        voice_conversation_service=default_voice_conversation_service,
        tts_service=default_tts_service,
    ) -> None:
        self.rag_service = rag_service
        self.voice_conversation_service = voice_conversation_service
        self.tts_service = tts_service

    async def create_chat(
        self,
        session,
        *,
        current_user: User,
        payload: ChatCreateRequest | None = None,
    ) -> ChatSummaryResponse:
        title = payload.title.strip() if payload and payload.title else None
        chat = await chat_repository.create_chat(
            session,
            user_id=current_user.id,
            title=title or None,
        )
        await audit_service.logger(current_user.id).event(AuditEventCode.CHAT_STARTED).resource("chat", chat.id).desc("New chat session started.").commit(session)
        await session.commit()
        return self._to_chat_summary(chat, message_count=0, last_message_preview=None)

    async def list_chats(
        self,
        session,
        *,
        current_user: User,
        limit: int,
    ) -> ChatListResponse:
        normalized_limit = max(1, min(limit, 100))
        rows, has_more = await chat_repository.list_chats_for_user(
            session,
            user_id=current_user.id,
            limit=normalized_limit,
        )
        return ChatListResponse(
            items=[
                self._to_chat_summary(chat, message_count=message_count, last_message_preview=preview)
                for chat, message_count, preview in rows
            ],
            has_more=has_more,
        )

    async def get_chat_messages(
        self,
        session,
        *,
        current_user: User,
        chat_id: UUID,
        limit: int = 10,
        before: datetime | None = None,
    ) -> ChatMessagesResponse:
        chat = await self._get_owned_chat(session, current_user=current_user, chat_id=chat_id)
        messages, has_more = await chat_repository.list_messages_page_for_chat(
            session,
            chat_id=chat.id,
            limit=limit,
            before=before,
        )
        total_message_count = await chat_repository.count_messages_for_chat(session, chat_id=chat.id)
        latest_messages = await chat_repository.list_recent_messages_for_chat(
            session,
            chat_id=chat.id,
            limit=1,
        )
        summary = self._to_chat_summary(
            chat,
            message_count=total_message_count,
            last_message_preview=latest_messages[-1].content if latest_messages else None,
        )
        return ChatMessagesResponse(
            chat=summary,
            items=[self._to_chat_message(message) for message in messages],
            has_more=has_more,
            next_before=messages[0].created_at if messages else None,
        )

    async def send_message(
        self,
        session,
        *,
        current_user: User,
        chat_id: UUID,
        payload: ChatMessageCreateRequest,
        locale: str = "en",
    ) -> ChatSendResponse:
        chat = await self._get_owned_chat(session, current_user=current_user, chat_id=chat_id)
        history = await self._build_history(session, chat_id=chat.id)
        user_message = await chat_repository.create_message(
            session,
            chat_id=chat.id,
            sender=ChatMessageSender.USER.value,
            content=payload.message,
        )
        await self._ensure_chat_title(session, chat=chat, first_user_message=payload.message)

        response = await self._answer_with_fallback(
            payload.message,
            history,
            locale=locale,
            user_id=str(current_user.id),
        )
        if payload.voice_mode:
            await self.build_voice_response(
                question=payload.message,
                history=history,
                locale=locale,
                response=response,
            )
        assistant_message = await chat_repository.create_message(
            session,
            chat_id=chat.id,
            sender=ChatMessageSender.ASSISTANT.value,
            content=response.answer,
            metadata=self._build_message_metadata(response),
        )
        await chat_repository.touch_chat(
            session,
            chat=chat,
            when=datetime.now(timezone.utc),
        )
        await session.commit()

        summary = await self._build_chat_summary_after_send(session, chat_id=chat.id, user_id=current_user.id)
        return ChatSendResponse(
            chat=summary,
            user_message=self._to_chat_message(user_message),
            assistant_message=self._to_chat_message(assistant_message),
            voice_response=response.voice_response,
        )

    async def stream_message(
        self,
        session,
        *,
        current_user: User,
        chat_id: UUID,
        payload: ChatMessageCreateRequest,
        locale: str = "en",
    ) -> AsyncGenerator[dict[str, Any], None]:
        chat = await self._get_owned_chat(session, current_user=current_user, chat_id=chat_id)
        history = await self._build_history(session, chat_id=chat.id)
        await chat_repository.create_message(
            session,
            chat_id=chat.id,
            sender=ChatMessageSender.USER.value,
            content=payload.message,
        )
        await self._ensure_chat_title(session, chat=chat, first_user_message=payload.message)
        await chat_repository.touch_chat(
            session,
            chat=chat,
            when=datetime.now(timezone.utc),
        )
        await session.commit()

        if payload.voice_mode:
            prepared = await self.prepare_voice_turn(
                question=payload.message,
                history=history,
                locale=locale,
                user_id=str(current_user.id),
            )
            response = prepared.response

            yield self.build_voice_ready_event(prepared)
            yield {"type": "token", "content": response.answer}

            await chat_repository.create_message(
                session,
                chat_id=chat.id,
                sender=ChatMessageSender.ASSISTANT.value,
                content=response.answer,
                metadata=self._build_message_metadata(response),
            )
            await chat_repository.touch_chat(
                session,
                chat=chat,
                when=datetime.now(timezone.utc),
            )
            await session.commit()

            final_event = self.build_stream_done_event(response)
            chat_summary = await self._build_chat_summary_after_send(
                session,
                chat_id=chat.id,
                user_id=current_user.id,
            )
            final_event["chat_summary"] = chat_summary.model_dump(mode="json")
            yield final_event
            return

        buffered_tokens: list[str] = []
        final_event: dict[str, Any] | None = None

        try:
            async for chunk in self._stream_answer_query(
                payload.message,
                history=history,
                locale=locale,
                user_id=str(current_user.id),
            ):
                if chunk.get("type") == "token":
                    token = str(chunk.get("content", ""))
                    buffered_tokens.append(token)
                    yield chunk
                elif chunk.get("type") == "done":
                    final_event = chunk
        except Exception as exc:
            # Convert the empty-knowledge-base path into a persisted assistant response.
            from app.core.exceptions import NoContextFoundError

            if not isinstance(exc, NoContextFoundError):
                raise

            no_context_event = {
                "type": "done",
                "primary_citations": [],
                "secondary_citations": [],
                "all_citations": [],
                "hidden_sources_count": 0,
                "mode_used": "rag",
                "max_confidence": 0.0,
            }
            buffered_tokens.append(NO_CONTEXT_RESPONSE)
            final_event = no_context_event
            yield {"type": "token", "content": NO_CONTEXT_RESPONSE}

        if final_event is None:
            return

        response = ChatResponse(
            answer="".join(buffered_tokens).strip(),
            primary_citations=[Citation.model_validate(item) for item in final_event.get("primary_citations", [])],
            secondary_citations=[Citation.model_validate(item) for item in final_event.get("secondary_citations", [])],
            all_citations=[Citation.model_validate(item) for item in final_event.get("all_citations", [])],
            hidden_sources_count=int(final_event.get("hidden_sources_count", 0) or 0),
            mode_used=str(final_event.get("mode_used", "rag")),
            max_confidence=float(final_event.get("max_confidence", 0.0) or 0.0),
            what_i_found=final_event.get("what_i_found"),
        )
        if payload.voice_mode:
            await self.build_voice_response(
                question=payload.message,
                history=history,
                locale=locale,
                response=response,
            )
            final_event["voice_response"] = response.voice_response

        await chat_repository.create_message(
            session,
            chat_id=chat.id,
            sender=ChatMessageSender.ASSISTANT.value,
            content=response.answer,
            metadata=self._build_message_metadata(response),
        )
        await chat_repository.touch_chat(
            session,
            chat=chat,
            when=datetime.now(timezone.utc),
        )
        await session.commit()

        chat_summary = await self._build_chat_summary_after_send(session, chat_id=chat.id, user_id=current_user.id)
        final_event["chat_summary"] = chat_summary.model_dump(mode="json")
        yield final_event

    async def prepare_voice_turn(
        self,
        *,
        question: str,
        history: list[ConversationMessage],
        locale: str = "en",
        user_id: str | None = None,
        response: ChatResponse | None = None,
    ) -> PreparedVoiceTurn:
        base_response = response or await self._answer_with_fallback(
            question,
            history,
            locale=locale,
            user_id=user_id,
        )
        voice_text = await self.build_voice_response(
            question=question,
            history=history,
            locale=locale,
            response=base_response,
        )

        audio_bytes = b""
        audio_content_type = self.tts_service.content_type()
        if voice_text:
            try:
                audio_bytes = await self.tts_service.synthesize(
                    text=voice_text,
                    language=locale,
                )
                logger.info(
                    "chat_service.voice_audio_prepared",
                    locale=locale,
                    voice_length=len(voice_text),
                    audio_bytes=len(audio_bytes),
                )
            except Exception as exc:
                logger.warning(
                    "chat_service.voice_audio_prep_failed",
                    error=str(exc),
                    locale=locale,
                    voice_length=len(voice_text),
                )

        return PreparedVoiceTurn(
            response=base_response,
            voice_audio_bytes=audio_bytes,
            voice_audio_content_type=audio_content_type,
        )

    async def build_voice_response(
        self,
        *,
        question: str,
        history: list[ConversationMessage],
        locale: str,
        response: ChatResponse,
    ) -> str:
        voice_text = await self.voice_conversation_service.create_voice_response(
            question=question,
            answer=response.answer,
            history=history,
            locale=locale,
            mode_used=response.mode_used,
        )
        response.voice_response = voice_text
        logger.info(
            "chat_service.voice_response_ready",
            locale=locale,
            mode_used=response.mode_used,
            answer_length=len(response.answer),
            voice_length=len(voice_text),
        )
        return voice_text

    def build_voice_ready_event(self, prepared: PreparedVoiceTurn) -> dict[str, str]:
        return {
            "type": "voice_ready",
            "voice_response": prepared.response.voice_response or "",
            "voice_audio_base64": base64.b64encode(prepared.voice_audio_bytes).decode("ascii")
            if prepared.voice_audio_bytes
            else "",
            "voice_audio_content_type": prepared.voice_audio_content_type,
        }

    def build_stream_done_event(self, response: ChatResponse) -> dict[str, Any]:
        return {
            "type": "done",
            "primary_citations": [citation.model_dump(mode="json") for citation in response.primary_citations],
            "secondary_citations": [citation.model_dump(mode="json") for citation in response.secondary_citations],
            "all_citations": [citation.model_dump(mode="json") for citation in response.all_citations],
            "hidden_sources_count": response.hidden_sources_count,
            "mode_used": response.mode_used,
            "max_confidence": response.max_confidence,
            "what_i_found": response.what_i_found,
            "voice_response": response.voice_response,
        }

    async def delete_chat(
        self,
        session,
        *,
        current_user: User,
        chat_id: UUID,
    ) -> None:
        chat = await self._get_owned_chat(session, current_user=current_user, chat_id=chat_id)
        await chat_repository.soft_delete_chat(session, chat=chat)
        await audit_service.logger(current_user.id).event(AuditEventCode.CHAT_DELETED).resource("chat", chat.id).desc(f"Chat '{chat.title or 'Untitled'}' deleted.").commit(session)
        await session.commit()

    async def _build_history(self, session, *, chat_id: UUID) -> list[ConversationMessage]:
        recent_messages = await chat_repository.list_recent_messages_for_chat(session, chat_id=chat_id, limit=10)
        history: list[ConversationMessage] = []
        for message in recent_messages:
            if message.sender not in (ChatMessageSender.USER.value, ChatMessageSender.ASSISTANT.value):
                continue
            history.append(
                ConversationMessage(role=message.sender, content=message.content)
            )
        return history

    async def _get_owned_chat(self, session, *, current_user: User, chat_id: UUID) -> ChatSession:
        chat = await chat_repository.get_chat_for_user(
            session,
            chat_id=chat_id,
            user_id=current_user.id,
        )
        if chat is None:
            raise ResourceNotFoundError(detail="Chat not found.")
        return chat

    async def _ensure_chat_title(self, session, *, chat: ChatSession, first_user_message: str) -> None:
        if chat.title:
            return
        generated = self._generate_title(first_user_message)
        await chat_repository.update_chat_title(session, chat=chat, title=generated)
        await audit_service.logger(chat.user_id).event(AuditEventCode.CHAT_TITLED).resource("chat", chat.id).desc(f"Chat auto-titled to '{generated}'.").context(title=generated).commit(session)

    async def _build_chat_summary_after_send(self, session, *, chat_id: UUID, user_id: UUID) -> ChatSummaryResponse:
        chat = await chat_repository.get_chat_for_user(session, chat_id=chat_id, user_id=user_id)
        if chat is None:
            raise ResourceNotFoundError(detail="Chat not found.")
        messages = await chat_repository.list_messages_for_chat(session, chat_id=chat.id)
        return self._to_chat_summary(
            chat,
            message_count=len(messages),
            last_message_preview=messages[-1].content if messages else None,
        )

    async def _answer_with_fallback(
        self,
        question: str,
        history: list[ConversationMessage],
        locale: str = "en",
        user_id: str | None = None,
    ) -> ChatResponse:
        from app.core.exceptions import NoContextFoundError

        try:
            return await self._call_answer_query(
                question,
                history=history,
                locale=locale,
                user_id=user_id,
            )
        except NoContextFoundError:
            return ChatResponse(
                answer=NO_CONTEXT_RESPONSE,
                primary_citations=[],
                secondary_citations=[],
                all_citations=[],
                hidden_sources_count=0,
                mode_used="rag",
                max_confidence=0.0,
            )

    async def _call_answer_query(
        self,
        question: str,
        *,
        history: list[ConversationMessage],
        locale: str,
        user_id: str | None,
    ) -> ChatResponse:
        try:
            return await self.rag_service.answer_query(
                question,
                history=history,
                locale=locale,
                user_id=user_id,
            )
        except TypeError as exc:
            message = str(exc)
            if "user_id" in message and "locale" in message:
                return await self.rag_service.answer_query(question, history=history)
            if "user_id" in message:
                return await self.rag_service.answer_query(
                    question,
                    history=history,
                    locale=locale,
                )
            if "locale" in message:
                return await self.rag_service.answer_query(
                    question,
                    history=history,
                    user_id=user_id,
                )
            raise

    def _stream_answer_query(
        self,
        question: str,
        *,
        history: list[ConversationMessage],
        locale: str,
        user_id: str | None,
    ):
        try:
            return self.rag_service.answer_query_stream(
                question,
                history=history,
                locale=locale,
                user_id=user_id,
            )
        except TypeError as exc:
            message = str(exc)
            if "user_id" in message and "locale" in message:
                return self.rag_service.answer_query_stream(question, history=history)
            if "user_id" in message:
                return self.rag_service.answer_query_stream(
                    question,
                    history=history,
                    locale=locale,
                )
            if "locale" in message:
                return self.rag_service.answer_query_stream(
                    question,
                    history=history,
                    user_id=user_id,
                )
            raise

    @staticmethod
    def _generate_title(content: str) -> str:
        normalized = " ".join(content.strip().split())
        if not normalized:
            return "New chat"
        if len(normalized) <= 60:
            return normalized
        return normalized[:57].rstrip() + "..."

    def _build_message_metadata(self, response: ChatResponse) -> dict[str, Any]:
        return {
            "primary_citations": [citation.model_dump(mode="json") for citation in response.primary_citations],
            "secondary_citations": [citation.model_dump(mode="json") for citation in response.secondary_citations],
            "all_citations": [citation.model_dump(mode="json") for citation in response.all_citations],
            "hidden_sources_count": response.hidden_sources_count,
            "mode_used": response.mode_used,
            "max_confidence": response.max_confidence,
            "what_i_found": response.what_i_found,
        }

    def _to_chat_message(self, message: ChatMessageRecord) -> ChatMessageResponse:
        metadata = message.metadata_json or {}
        return ChatMessageResponse(
            id=message.id,
            chat_id=message.chat_id,
            sender=ChatMessageSender(message.sender),
            content=message.content,
            created_at=message.created_at,
            primary_citations=[Citation.model_validate(item) for item in metadata.get("primary_citations", [])],
            secondary_citations=[Citation.model_validate(item) for item in metadata.get("secondary_citations", [])],
            all_citations=[Citation.model_validate(item) for item in metadata.get("all_citations", [])],
            hidden_sources_count=int(metadata.get("hidden_sources_count", 0) or 0),
            mode_used=metadata.get("mode_used"),
            max_confidence=metadata.get("max_confidence"),
            what_i_found=metadata.get("what_i_found"),
        )

    @staticmethod
    def _to_chat_summary(
        chat: ChatSession,
        *,
        message_count: int,
        last_message_preview: str | None,
    ) -> ChatSummaryResponse:
        preview = None
        if last_message_preview:
            normalized = " ".join(last_message_preview.strip().split())
            preview = normalized[:117].rstrip() + "..." if len(normalized) > 120 else normalized

        return ChatSummaryResponse(
            id=chat.id,
            title=chat.title,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            message_count=message_count,
            last_message_preview=preview,
        )


chat_service = ChatService()
