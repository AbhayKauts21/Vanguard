from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.exceptions import AzureConfigurationError, DatabaseConfigurationError, EmbeddingConfigurationError


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Centralized application configuration loaded from .env file."""

    PROJECT_NAME: str = "CLEO"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def coerce_debug(cls, v: Any) -> bool:
        """Accept 'true'/'false'/'1'/'0'/'release' etc from env."""
        if isinstance(v, bool):
            return v
        return str(v).lower() in ("true", "1", "yes", "on")

    # Embeddings — Azure OpenAI configuration
    EMBEDDING_DIMENSIONS: int = 3072

    # Azure OpenAI Foundry — shared generation and embedding provider
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_API_VERSION: str = ""
    AZURE_OPENAI_CHAT_DEPLOYMENT: str = ""
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: str = ""
    AZURE_OPENAI_AUTH_MODE: str = "api_key"
    AZURE_OPENAI_TIMEOUT_SECONDS: float = 30.0
    AZURE_OPENAI_MAX_RETRIES: int = 2

    # Pinecone — serverless vector store
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "cleo-docs"
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"
    DOCUMENT_VECTOR_NAMESPACE: str = "bookstack"

    # BookStack — knowledge base source
    BOOKSTACK_URL: str = ""
    BOOKSTACK_TOKEN_ID: str = ""
    BOOKSTACK_TOKEN_SECRET: str = ""
    BOOKSTACK_SOURCE_KEY: str = "bookstack_default"
    BOOKSTACK_SOURCE_NAME: str = "BookStack"

    # Ingestion pipeline tuning
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 200
    MIN_SIMILARITY_SCORE: float = 0.40
    SYNC_INTERVAL_MINUTES: int = 5
    TOP_K_RESULTS: int = 8

    # Webhook verification
    BOOKSTACK_WEBHOOK_SECRET: str = ""

    # HeyGen avatar (future use)
    HEYGEN_API_KEY: str = ""

    # Azure Speech Services — voice pipeline TTS
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = "eastus"
    AZURE_TTS_VOICE: str = "en-US-JennyNeural"
    AZURE_TTS_OUTPUT_FORMAT: str = "audio-24khz-48kbitrate-mono-mp3"

    # Security — Phase 7
    ADMIN_API_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    RATE_LIMIT_PER_MINUTE: int = 30

    # Postgres / SQLAlchemy
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = ""
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""

    # JWT auth / RBAC
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    AUTH_DEFAULT_ROLE: str = "viewer"
    PASSWORD_RESET_CODE_EXPIRE_MINUTES: int = 15

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()


def validate_azure_openai_settings(cfg: Settings) -> None:
    """Fail fast when Azure direct-chat settings are incomplete or unsupported."""
    missing = [
        name
        for name, value in (
            ("AZURE_OPENAI_ENDPOINT", cfg.AZURE_OPENAI_ENDPOINT),
            ("AZURE_OPENAI_API_KEY", cfg.AZURE_OPENAI_API_KEY),
            ("AZURE_OPENAI_CHAT_DEPLOYMENT", cfg.AZURE_OPENAI_CHAT_DEPLOYMENT),
        )
        if not value
    ]
    if missing:
        raise AzureConfigurationError(
            detail=(
                "Azure OpenAI is not fully configured. Missing settings: "
                + ", ".join(missing)
            )
        )


def validate_azure_embedding_settings(cfg: Settings) -> None:
    """Fail fast when Azure embedding settings are incomplete or unsupported."""
    missing = [
        name
        for name, value in (
            ("AZURE_OPENAI_ENDPOINT", cfg.AZURE_OPENAI_ENDPOINT),
            ("AZURE_OPENAI_API_KEY", cfg.AZURE_OPENAI_API_KEY),
            ("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", cfg.AZURE_OPENAI_EMBEDDING_DEPLOYMENT),
        )
        if not value
    ]
    if missing:
        raise EmbeddingConfigurationError(
            detail=(
                "Azure embeddings are not fully configured. Missing settings: "
                + ", ".join(missing)
            )
        )

    if cfg.AZURE_OPENAI_AUTH_MODE != "api_key":
        raise AzureConfigurationError(
            detail=(
                "Unsupported AZURE_OPENAI_AUTH_MODE. "
                "Only 'api_key' is supported in v1."
            )
        )


def build_async_database_url(cfg: Settings) -> str:
    """Build the SQLAlchemy async Postgres URL from settings."""
    if not cfg.POSTGRES_DB or not cfg.POSTGRES_USER:
        return ""

    password = quote_plus(cfg.POSTGRES_PASSWORD)
    return (
        f"postgresql+asyncpg://{cfg.POSTGRES_USER}:{password}"
        f"@{cfg.POSTGRES_HOST}:{cfg.POSTGRES_PORT}/{cfg.POSTGRES_DB}"
    )


def build_sync_database_url(cfg: Settings) -> str:
    """Build the SQLAlchemy sync Postgres URL for Alembic."""
    if not cfg.POSTGRES_DB or not cfg.POSTGRES_USER:
        return ""

    password = quote_plus(cfg.POSTGRES_PASSWORD)
    return (
        f"postgresql+psycopg://{cfg.POSTGRES_USER}:{password}"
        f"@{cfg.POSTGRES_HOST}:{cfg.POSTGRES_PORT}/{cfg.POSTGRES_DB}"
    )


def validate_database_settings(cfg: Settings) -> None:
    """Fail fast when Postgres-backed auth configuration is incomplete."""
    missing = [
        name
        for name, value in (
            ("POSTGRES_HOST", cfg.POSTGRES_HOST),
            ("POSTGRES_PORT", cfg.POSTGRES_PORT),
            ("POSTGRES_DB", cfg.POSTGRES_DB),
            ("POSTGRES_USER", cfg.POSTGRES_USER),
            ("JWT_SECRET_KEY", cfg.JWT_SECRET_KEY),
        )
        if value in ("", None)
    ]
    if missing:
        raise DatabaseConfigurationError(
            detail=(
                "Postgres/JWT configuration is incomplete. Missing settings: "
                + ", ".join(missing)
            )
        )

    if cfg.AZURE_OPENAI_AUTH_MODE != "api_key":
        raise AzureConfigurationError(
            detail=(
                "Unsupported AZURE_OPENAI_AUTH_MODE. "
                "Only 'api_key' is supported in v1."
            )
        )
