from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.exceptions import AzureConfigurationError


class Settings(BaseSettings):
    """Centralized application configuration loaded from .env file."""

    PROJECT_NAME: str = "Project Vanguard"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # OpenAI — shared key for embeddings + generation
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Azure OpenAI Foundry — direct chat module
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_API_VERSION: str = ""
    AZURE_OPENAI_CHAT_DEPLOYMENT: str = ""
    AZURE_OPENAI_AUTH_MODE: str = "api_key"
    AZURE_OPENAI_TIMEOUT_SECONDS: float = 30.0
    AZURE_OPENAI_MAX_RETRIES: int = 2

    # Pinecone — serverless vector store
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "vanguard-docs"
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"

    # BookStack — knowledge base source
    BOOKSTACK_URL: str = ""
    BOOKSTACK_TOKEN_ID: str = ""
    BOOKSTACK_TOKEN_SECRET: str = ""

    # Ingestion pipeline tuning
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 200
    MIN_SIMILARITY_SCORE: float = 0.78
    SYNC_INTERVAL_MINUTES: int = 5
    TOP_K_RESULTS: int = 5

    # Webhook verification
    BOOKSTACK_WEBHOOK_SECRET: str = ""

    # HeyGen avatar (future use)
    HEYGEN_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()


def build_azure_openai_base_url(endpoint: str) -> str:
    """Normalize Azure resource endpoint into the SDK base_url format."""
    normalized = endpoint.rstrip("/")
    if not normalized:
        return ""
    return f"{normalized}/openai/v1/"


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

    if cfg.AZURE_OPENAI_AUTH_MODE != "api_key":
        raise AzureConfigurationError(
            detail=(
                "Unsupported AZURE_OPENAI_AUTH_MODE. "
                "Only 'api_key' is supported in v1."
            )
        )
