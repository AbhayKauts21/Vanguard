"""Provider abstraction for external documentation systems."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from app.domain.schemas import DocumentReference, NormalizedDocument


class DocumentProvider(ABC):
    """Abstract provider strategy for full/delta/fetch/delete document workflows."""

    provider_type: str

    @abstractmethod
    async def health_check(self) -> bool:
        """Return whether the upstream provider is reachable."""

    @abstractmethod
    async def list_documents(self) -> list[DocumentReference]:
        """Return provider references for a full sync."""

    @abstractmethod
    async def list_documents_updated_since(self, since: datetime) -> list[DocumentReference]:
        """Return provider references updated since the given time."""

    @abstractmethod
    async def get_document(
        self,
        external_document_id: str,
        *,
        reference: DocumentReference | None = None,
    ) -> NormalizedDocument:
        """Fetch and normalize a single external document."""

    async def resolve_deletion(self, external_document_id: str) -> str:
        """Map a provider-specific delete event into a stable external ID."""
        return external_document_id
