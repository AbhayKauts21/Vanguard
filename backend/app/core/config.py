from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application configuration loaded from .env file."""

    PROJECT_NAME: str = "Project Vanguard"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # OpenAI — shared key for embeddings + generation
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

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
