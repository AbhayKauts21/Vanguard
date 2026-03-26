# GitHub Workflow — Environment Variable Reference

When triggering the `deploy.yml` workflow manually, paste the JSON below into the
`backend_env` and `frontend_env` input fields.

---

## backend_env (JSON)

```json
{
  "POSTGRES_HOST": "localhost",
  "POSTGRES_PORT": "5432",
  "POSTGRES_DB": "vanguard",
  "POSTGRES_USER": "postgres",
  "POSTGRES_PASSWORD": "your-postgres-password",

  "JWT_SECRET_KEY": "replace-with-a-long-random-secret-min-32-chars",
  "JWT_ALGORITHM": "HS256",
  "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "30",
  "JWT_REFRESH_TOKEN_EXPIRE_DAYS": "14",
  "AUTH_DEFAULT_ROLE": "viewer",
  "ADMIN_API_KEY": "change-me-in-production",
  "ALLOWED_ORIGINS": "https://cleo.andinolabs.ai,https://api.andinolabs.ai",
  "RATE_LIMIT_PER_MINUTE": "30",

  "PROJECT_NAME": "CLEO",
  "DEBUG": "false",
  "API_V1_STR": "/api/v1",

  "EMBEDDING_DIMENSIONS": "3072",

  "AZURE_OPENAI_ENDPOINT": "https://your-resource.openai.azure.com/",
  "AZURE_OPENAI_API_KEY": "your-azure-openai-api-key",
  "AZURE_OPENAI_API_VERSION": "2024-02-15-preview",
  "AZURE_OPENAI_CHAT_DEPLOYMENT": "gpt-4o-mini",
  "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "text-embedding-3-large",
  "AZURE_OPENAI_AUTH_MODE": "api_key",
  "AZURE_OPENAI_TIMEOUT_SECONDS": "30",
  "AZURE_OPENAI_MAX_RETRIES": "2",

  "PINECONE_API_KEY": "pcsk_your-pinecone-api-key",
  "PINECONE_INDEX_NAME": "cleo-prod",
  "PINECONE_CLOUD": "aws",
  "PINECONE_REGION": "us-east-1",

  "BOOKSTACK_URL": "",
  "BOOKSTACK_TOKEN_ID": "",
  "BOOKSTACK_TOKEN_SECRET": "",
  "BOOKSTACK_WEBHOOK_SECRET": "",

  "CHUNK_SIZE": "800",
  "CHUNK_OVERLAP": "200",
  "MIN_SIMILARITY_SCORE": "0.45",
  "SYNC_INTERVAL_MINUTES": "5",
  "TOP_K_RESULTS": "5",

  "OTEL_ENABLED": "true",
  "OTEL_SERVICE_NAME": "cleo-backend",
  "SERVICE_VERSION": "1.0.0",
  "ENVIRONMENT": "production",
  "OTEL_EXPORTER_OTLP_ENDPOINT": "http://otel-collector:4317",
  "LOG_LEVEL": "INFO",
  "LOG_FORMAT": "json"
}
```

---

## frontend_env (JSON)

```json
{
  "NEXT_PUBLIC_APP_NAME": "CLEO",
  "NEXT_PUBLIC_APP_VERSION": "1.0.0",
  "NEXT_PUBLIC_DEFAULT_LOCALE": "en",
  "NEXT_PUBLIC_SUPPORTED_LOCALES": "en,es",

  "NEXT_PUBLIC_API_BASE_URL": "https://api.andinolabs.ai",

  "NEXT_PUBLIC_ENABLE_STREAMING": "true",
  "NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS": "true",
  "NEXT_PUBLIC_ENABLE_AVATAR": "false",

  "NEXT_PUBLIC_HEYGEN_AVATAR_ID": "",
  "NEXT_PUBLIC_HEYGEN_VOICE_ID": "",
  "HEYGEN_API_KEY": "",

  "NEXT_PUBLIC_OTEL_ENABLED": "true",
  "NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318/v1/traces",

  "NODE_ENV": "production",
  "PORT": "3000"
}
```

---

## Notes

- All values must be strings (wrap numbers and booleans in quotes)
- `NEXT_PUBLIC_API_BASE_URL` must point to your backend domain: `https://api.andinolabs.ai`
- `ALLOWED_ORIGINS` in backend must include your frontend domain: `https://cleo.andinolabs.ai`
- `OTEL_EXPORTER_OTLP_ENDPOINT` uses the internal Docker network name `otel-collector` — do not change this
- BookStack fields can be left empty (`""`) if not using BookStack integration
- HeyGen fields can be left empty if `NEXT_PUBLIC_ENABLE_AVATAR` is `false`
