"""User document upload, blob persistence, and indexing workflow."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from uuid import UUID, uuid4
from zlib import crc32
import io

from fastapi import BackgroundTasks, UploadFile
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.azure_blob_storage import (
    AzureBlobStorageAdapter,
    azure_blob_storage as default_blob_storage,
)
from app.adapters.embedding_client import (
    EmbeddingClient,
    embedding_client as default_embedding_client,
)
from app.adapters.vector_store import vector_store as default_vector_store
from app.core.config import settings
from app.core.exceptions import (
    AuthorizationError,
    BadRequestError,
    IngestionError,
    ResourceNotFoundError,
)
from app.db.models import Document, User
from app.db.session import get_session_factory
from app.domain.schemas import DocumentUploadStatus, TextChunk, UploadedDocumentResponse
from app.repositories.document_repository import document_repository
from app.services.text_processor import (
    TextProcessor,
    text_processor as default_text_processor,
)
from app.services.audit_service import audit_service
from app.domain.audit_log import AuditEventCode


class DocumentUploadService:
    ALLOWED_EXTENSIONS = {".pdf", ".md", ".markdown"}
    MARKDOWN_EXTENSIONS = {".md", ".markdown"}

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        embedding_client: EmbeddingClient = default_embedding_client,
        vector_store=default_vector_store,
        text_processor: TextProcessor = default_text_processor,
        blob_storage: AzureBlobStorageAdapter = default_blob_storage,
        repository=document_repository,
    ) -> None:
        self.session_factory = session_factory or get_session_factory()
        self.embedding_client = embedding_client
        self.vector_store = vector_store
        self.text_processor = text_processor
        self.blob_storage = blob_storage
        self.repository = repository

    async def upload_document(
        self,
        session: AsyncSession,
        *,
        current_user: User,
        file: UploadFile,
        background_tasks: BackgroundTasks,
        title: str | None = None,
        tags: list[str] | None = None,
        requested_user_id: UUID | None = None,
    ) -> UploadedDocumentResponse:
        if requested_user_id and requested_user_id != current_user.id:
            raise AuthorizationError(detail="You can only upload documents for your own account.")

        file_name = self._sanitize_file_name(file.filename or "upload")
        extension = Path(file_name).suffix.lower()
        if extension not in self.ALLOWED_EXTENSIONS:
            raise BadRequestError(detail="Only PDF and Markdown uploads are supported.")

        payload = await file.read()
        file_size = len(payload)
        if file_size == 0:
            raise BadRequestError(detail="Uploaded file is empty.")
        if file_size > settings.DOCUMENT_UPLOAD_MAX_BYTES:
            raise BadRequestError(
                detail=(
                    f"Uploaded file exceeds the {settings.DOCUMENT_UPLOAD_MAX_BYTES} byte limit."
                )
            )

        normalized_tags = self._normalize_tags(tags)
        document_title = (title or Path(file_name).stem).strip() or Path(file_name).stem
        content_type = file.content_type or self._guess_content_type(extension)
        blob_name = self._build_blob_name(
            user_id=str(current_user.id),
            upload_id=str(uuid4()),
            file_name=file_name,
        )
        blob_url = await self.blob_storage.upload_bytes(
            blob_name=blob_name,
            data=payload,
            content_type=content_type,
        )

        document = await self.repository.create_uploaded_document(
            session,
            user_id=current_user.id,
            file_name=file_name,
            title=document_title,
            blob_name=blob_name,
            blob_url=blob_url,
            content_type=content_type,
            file_size=file_size,
            tags=normalized_tags,
            status=DocumentUploadStatus.PENDING.value,
        )
        await session.flush()
        
        await audit_service.logger(current_user.id).event(AuditEventCode.DOC_UPLOADED).resource("document", document.id).desc(f"Document '{file_name}' uploaded. Processing started.").context(file_name=file_name, size=file_size).commit(session)
        
        await session.commit()
        await session.refresh(document)

        background_tasks.add_task(self.process_document, document.id, payload)


        await audit_service.logger(current_user.id).event(AuditEventCode.DOC_UPLOADED).resource("document", document.id).desc(f"Document '{file_name}' uploaded. Processing started.").context(file_name=file_name, size=file_size).commit(session)

        return await self._to_response(document)

    async def list_documents_for_user(
        self,
        session: AsyncSession,
        *,
        current_user: User,
    ) -> list[UploadedDocumentResponse]:
        documents = await self.repository.list_uploaded_documents_for_user(
            session,
            user_id=current_user.id,
        )
        return [await self._to_response(document) for document in documents]

    async def process_document(self, document_id: UUID, payload: bytes) -> None:
        async with self.session_factory() as session:
            document = await self.repository.get_uploaded_document_by_id(session, document_id)
            if document is None:
                logger.warning("document.process.missing", document_id=str(document_id))
                return

            document.status = DocumentUploadStatus.PROCESSING.value
            document.error_detail = None
            session.add(document)
            await session.commit()

        try:
            async with self.session_factory() as session:
                document = await self.repository.get_uploaded_document_by_id(session, document_id)
                if document is None:
                    raise ResourceNotFoundError(detail="Uploaded document not found.")

                extraction = self._extract_content(document, payload)
                access_url = await self.blob_storage.generate_access_url(blob_name=document.blob_name)
                chunks = self._build_chunks(document, extraction=extraction, access_url=access_url)
                if not chunks:
                    raise IngestionError(
                        detail="No extractable text was found in the uploaded document."
                    )

                logger.info(
                    "document.process.chunks_ready",
                    document_id=str(document.id),
                    chunks=len(chunks),
                    file_name=document.file_name,
                )
                await self.vector_store.delete_by_document_uid(str(document.id))
                vectors = await self.embedding_client.embed_texts([chunk.text for chunk in chunks])
                await self.vector_store.upsert_vectors(
                    ids=[chunk.chunk_id for chunk in chunks],
                    vectors=vectors,
                    metadatas=[chunk.metadata for chunk in chunks],
                )

                document.status = DocumentUploadStatus.READY.value
                document.processed_at = datetime.now(timezone.utc)
                document.error_detail = None
                session.add(document)
                
                await audit_service.logger(document.user_id).event(AuditEventCode.DOC_READY).resource("document", document.id).desc(f"Document '{document.file_name}' processed and indexed ({len(chunks)} chunks).").context(file_name=document.file_name, chunks=len(chunks)).commit(session)
                
                await session.commit()
        except Exception as exc:
            async with self.session_factory() as session:
                document = await self.repository.get_uploaded_document_by_id(session, document_id)
                if document is not None:
                    document.status = DocumentUploadStatus.FAILED.value
                    document.error_detail = str(exc)
                    session.add(document)
                    await audit_service.logger(document.user_id).event(AuditEventCode.DOC_PROCESSING_FAILED).resource("document", document.id).desc(f"Document '{document.file_name}' processing failed.").context(file_name=document.file_name, error=str(exc)).failed().commit(session)
                    await session.commit()
            logger.exception("document.process.failed", document_id=str(document_id), error=str(exc))

    def _extract_content(self, document: Document, payload: bytes) -> dict:
        extension = Path(document.file_name).suffix.lower()
        if extension in self.MARKDOWN_EXTENSIONS:
            text = payload.decode("utf-8", errors="ignore")
            return {
                "full_text": text,
                "pages": [
                    {
                        "page_number": 1,
                        "title": document.title,
                        "text": text,
                    }
                ],
            }

        if extension == ".pdf":
            try:
                from pypdf import PdfReader
            except ModuleNotFoundError as exc:
                raise IngestionError(detail="pypdf is not installed for PDF extraction.") from exc

            reader = PdfReader(io.BytesIO(payload))
            pages = []
            full_text_parts: list[str] = []
            for index, page in enumerate(reader.pages, start=1):
                text = (page.extract_text() or "").strip()
                if not text:
                    continue
                full_text_parts.append(text)
                pages.append(
                    {
                        "page_number": index,
                        "title": f"{document.title} (Page {index})",
                        "text": text,
                    }
                )
            return {
                "full_text": "\n\n".join(full_text_parts),
                "pages": pages,
            }

        raise IngestionError(detail="Unsupported uploaded document type.")

    def _build_chunks(
        self,
        document: Document,
        *,
        extraction: dict,
        access_url: str,
    ) -> list[TextChunk]:
        full_text = str(extraction.get("full_text", ""))
        pages = extraction.get("pages", [])
        chunks: list[TextChunk] = []
        for page in pages:
            page_number = int(page["page_number"])
            raw_text = str(page["text"] or "").strip()
            cleaned = self.text_processor.clean_markdown(raw_text)
            if not cleaned:
                continue

            page_id = self._resolve_page_id(document.id, page_number)
            metadata_base = {
                "page_id": page_id,
                "page_number": page_number,
                "page_title": page["title"],
                "book_id": 0,
                "book_title": document.title,
                "chapter_id": 0,
                "bookstack_url": access_url,
                "source_url": access_url,
                "source_type": "user_upload",
                "source_name": document.file_name,
                "source": "user_upload",
                "source_key": "user_uploads",
                "external_document_id": str(document.id),
                "document_uid": str(document.id),
                "document_id": str(document.id),
                "blob_url": document.blob_url,
                "file_name": document.file_name,
                "user_id": str(document.user_id),
                "content": cleaned[:1000],
                "full_doc_text": full_text if len(pages) == 1 else raw_text,
                "tags": list(document.tags_json or []),
            }
            page_chunks = self.text_processor.chunk_text(
                cleaned,
                page_id,
                metadata_base,
                chunk_id_prefix=f"{document.id}::page::{page_number}",
            )
            for chunk in page_chunks:
                chunk.metadata["chunk_id"] = chunk.chunk_id
            chunks.extend(page_chunks)
        return chunks

    async def _to_response(self, document: Document) -> UploadedDocumentResponse:
        download_url = await self.blob_storage.generate_access_url(blob_name=document.blob_name)
        return UploadedDocumentResponse(
            id=document.id,
            user_id=document.user_id,
            file_name=document.file_name,
            title=document.title,
            blob_url=document.blob_url,
            download_url=download_url,
            content_type=document.content_type,
            file_size=document.file_size,
            tags=list(document.tags_json or []),
            status=DocumentUploadStatus(document.status),
            error_detail=document.error_detail,
            processed_at=document.processed_at,
            created_at=document.created_at,
            updated_at=document.updated_at,
        )

    def _build_blob_name(self, *, user_id: str, upload_id: str, file_name: str) -> str:
        return f"user-documents/{user_id}/{upload_id}/{file_name}"

    def _sanitize_file_name(self, file_name: str) -> str:
        name = re.sub(r"[^A-Za-z0-9._-]+", "-", file_name).strip("-")
        return name or "upload"

    def _normalize_tags(self, tags: Iterable[str] | None) -> list[str]:
        normalized: list[str] = []
        for tag in tags or []:
            value = str(tag).strip()
            if value and value not in normalized:
                normalized.append(value)
        return normalized[:20]

    def _guess_content_type(self, extension: str) -> str:
        if extension == ".pdf":
            return "application/pdf"
        return "text/markdown"

    def _resolve_page_id(self, document_id: UUID, page_number: int) -> int:
        checksum = crc32(f"{document_id}:{page_number}".encode("utf-8"))
        return checksum & 0x7FFFFFFF


document_upload_service = DocumentUploadService()
