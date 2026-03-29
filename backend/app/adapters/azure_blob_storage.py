"""Azure Blob Storage adapter for user-uploaded documents."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from loguru import logger

from app.core.config import settings
from app.core.exceptions import AzureConfigurationError, StorageError


class AzureBlobStorageAdapter:
    def __init__(self) -> None:
        self._service_client = None

    def _validate_config(self) -> None:
        if settings.AZURE_BLOB_CONNECTION_STRING:
            return
        if (
            settings.AZURE_BLOB_ACCOUNT_URL
            and settings.AZURE_BLOB_ACCOUNT_NAME
            and settings.AZURE_BLOB_ACCOUNT_KEY
        ):
            return
        raise AzureConfigurationError(
            detail=(
                "Azure Blob Storage is not configured. Set AZURE_BLOB_CONNECTION_STRING "
                "or AZURE_BLOB_ACCOUNT_URL, AZURE_BLOB_ACCOUNT_NAME, and AZURE_BLOB_ACCOUNT_KEY."
            )
        )

    def _get_service_client(self):
        self._validate_config()
        if self._service_client is None:
            try:
                from azure.storage.blob.aio import BlobServiceClient
            except ModuleNotFoundError as exc:
                raise StorageError(
                    detail="azure-storage-blob is not installed for document uploads."
                ) from exc

            if settings.AZURE_BLOB_CONNECTION_STRING:
                self._service_client = BlobServiceClient.from_connection_string(
                    settings.AZURE_BLOB_CONNECTION_STRING
                )
            else:
                self._service_client = BlobServiceClient(
                    account_url=settings.AZURE_BLOB_ACCOUNT_URL,
                    credential=settings.AZURE_BLOB_ACCOUNT_KEY,
                )
        return self._service_client

    async def upload_bytes(
        self,
        *,
        blob_name: str,
        data: bytes,
        content_type: str,
    ) -> str:
        try:
            from azure.storage.blob import ContentSettings
        except ModuleNotFoundError as exc:
            raise StorageError(
                detail="azure-storage-blob is not installed for document uploads."
            ) from exc

        service_client = self._get_service_client()
        container_client = service_client.get_container_client(
            settings.AZURE_BLOB_CONTAINER_NAME
        )
        try:
            await container_client.create_container()
        except Exception as exc:
            if "ContainerAlreadyExists" not in str(exc):
                logger.debug("blob.container.ensure", error=str(exc))

        try:
            blob_client = service_client.get_blob_client(
                container=settings.AZURE_BLOB_CONTAINER_NAME,
                blob=blob_name,
            )
            await blob_client.upload_blob(
                data,
                overwrite=True,
                content_settings=ContentSettings(content_type=content_type),
            )
            logger.info("blob.upload.success", blob_name=blob_name, size_bytes=len(data))
            return blob_client.url
        except Exception as exc:
            logger.exception("blob.upload.failed", blob_name=blob_name, error=str(exc))
            raise StorageError(detail=f"Failed to upload blob '{blob_name}': {exc}") from exc

    async def generate_access_url(self, *, blob_name: str) -> str:
        canonical_url = self.build_canonical_url(blob_name=blob_name)
        account_name = self._resolve_account_name()
        account_key = settings.AZURE_BLOB_ACCOUNT_KEY or self._resolve_account_key_from_connection_string()
        if not account_name or not account_key:
            return canonical_url

        try:
            from azure.storage.blob import BlobSasPermissions, generate_blob_sas
        except ModuleNotFoundError:
            return canonical_url

        try:
            sas_token = generate_blob_sas(
                account_name=account_name,
                account_key=account_key,
                container_name=settings.AZURE_BLOB_CONTAINER_NAME,
                blob_name=blob_name,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.now(timezone.utc)
                + timedelta(minutes=settings.AZURE_BLOB_SAS_EXPIRY_MINUTES),
            )
            if not sas_token:
                return canonical_url
            return f"{canonical_url}?{sas_token}"
        except Exception as exc:
            logger.warning("blob.sas.generate_failed", blob_name=blob_name, error=str(exc))
            return canonical_url

    def build_canonical_url(self, *, blob_name: str) -> str:
        account_url = settings.AZURE_BLOB_ACCOUNT_URL.rstrip("/")
        if not account_url:
            account_name = self._resolve_account_name()
            if not account_name:
                raise AzureConfigurationError(
                    detail="Unable to derive Azure Blob URL. Configure AZURE_BLOB_ACCOUNT_URL."
                )
            account_url = f"https://{account_name}.blob.core.windows.net"
        return f"{account_url}/{settings.AZURE_BLOB_CONTAINER_NAME}/{quote(blob_name, safe='/')}"

    async def close(self) -> None:
        if self._service_client is not None:
            await self._service_client.close()
            self._service_client = None

    def _resolve_account_name(self) -> str:
        if settings.AZURE_BLOB_ACCOUNT_NAME:
            return settings.AZURE_BLOB_ACCOUNT_NAME
        if settings.AZURE_BLOB_CONNECTION_STRING:
            for part in settings.AZURE_BLOB_CONNECTION_STRING.split(";"):
                if part.startswith("AccountName="):
                    return part.split("=", 1)[1]
        if settings.AZURE_BLOB_ACCOUNT_URL:
            host = settings.AZURE_BLOB_ACCOUNT_URL.split("://")[-1].split("/")[0]
            return host.split(".")[0]
        return ""

    def _resolve_account_key_from_connection_string(self) -> str:
        if settings.AZURE_BLOB_CONNECTION_STRING:
            for part in settings.AZURE_BLOB_CONNECTION_STRING.split(";"):
                if part.startswith("AccountKey="):
                    return part.split("=", 1)[1]
        return ""


azure_blob_storage = AzureBlobStorageAdapter()
