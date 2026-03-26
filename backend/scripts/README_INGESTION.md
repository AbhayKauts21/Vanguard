# Pinecone Ingestion

This folder now has a single ingestion script:

- `ingest_docs_to_pinecone.py`

It reads local files, chunks them, embeds them with Azure OpenAI, and upserts them into Pinecone using the metadata shape CLEO expects.

## Usage

From the repo root:

```bash
backend/venv/bin/python backend/scripts/ingest_docs_to_pinecone.py /absolute/path/to/file.md
```

From `backend/`:

```bash
venv/bin/python scripts/ingest_docs_to_pinecone.py /absolute/path/to/file.md
```

## What You Can Pass

- A single file path
- Multiple file paths
- A directory path

If you pass a directory, the script ingests all supported files under it recursively.

Supported extensions:

- `.md`
- `.markdown`
- `.txt`

If you do not pass any path, the script falls back to `backend/scripts/temp_docs/`.

## Examples

Ingest one file:

```bash
backend/venv/bin/python backend/scripts/ingest_docs_to_pinecone.py \
  backend/scripts/temp_docs/01-overview-and-architecture.md
```

Ingest two files:

```bash
backend/venv/bin/python backend/scripts/ingest_docs_to_pinecone.py \
  backend/scripts/temp_docs/01-overview-and-architecture.md \
  backend/scripts/temp_docs/03-core-features.md
```

Ingest a whole directory:

```bash
backend/venv/bin/python backend/scripts/ingest_docs_to_pinecone.py \
  backend/scripts/temp_docs
```

## Notes

- The script always loads configuration from `backend/.env`, even if you run it from the repo root.
- Re-ingesting the same file replaces that file's previous chunks instead of creating duplicates.
- The script prints a final Pinecone namespace vector count after completion.

## Required Env Vars

These must be set in `backend/.env`:

```env
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=...
```
