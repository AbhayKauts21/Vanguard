from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Project Vanguard"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # OpenAI
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o"

    # Pinecone
    PINECONE_API_KEY: str | None = None
    PINECONE_ENVIRONMENT: str | None = None
    PINECONE_INDEX_NAME: str = "vanguard-docs"

    # BookStack
    BOOKSTACK_URL: str | None = None
    BOOKSTACK_TOKEN_ID: str | None = None
    BOOKSTACK_TOKEN_SECRET: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env", 
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
