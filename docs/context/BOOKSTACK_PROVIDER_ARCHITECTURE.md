# BookStack Provider Architecture

## Overview
- The documentation ingestion pipeline is now provider-based.
- BookStack is the first production provider, but the sync engine is designed to support Confluence, Azure Blob PDFs, Swagger/OpenAPI, and future sources without rewriting RAG or vector storage.
- Postgres stores source metadata, normalized document sync state, and sync run audit records.
- Pinecone stores chunk embeddings and retrieval metadata only.

## Architecture
- `BookStackClient`
  - raw REST API adapter for BookStack authentication, pagination, page fetch, and book lookup
- `DocumentProvider`
  - provider interface for health checks, full/delta discovery, single-document fetch, and deletion identity
- `BookStackProvider`
  - converts BookStack pages into provider-agnostic `DocumentReference` and `NormalizedDocument` objects
- `DocumentSyncService`
  - orchestrates source bootstrap, full sync, delta sync, single-document sync, delete handling, checksums, chunking, embedding, Pinecone upserts, and sync audit records
- `TextProcessor`
  - turns normalized documents into generic chunks keyed by `document_uid`
- `VectorStore`
  - stores all provider chunks in the shared `bookstack` namespace and uses provider-aware metadata filters

## Persistence Model
- `document_sources`
  - logical source registry
  - stores `source_key`, `provider_type`, display name, and non-secret config
- `normalized_documents`
  - one row per external document
  - stores provider identity, normalized metadata, checksum, timestamps, deletion state, and sync error state
- `document_sync_runs`
  - one row per full/delta/single-document/delete sync execution
  - stores counts, status, trigger type, and error details

## BookStack Sync Flow
1. Admin endpoint, scheduler, or webhook triggers `DocumentSyncService`.
2. The service ensures the default BookStack source exists in Postgres.
3. `BookStackProvider` lists document references or resolves a single page.
4. For each document:
   - fetch the full page body
   - normalize to `NormalizedDocument`
   - compare checksum and upstream timestamp
   - skip unchanged docs
   - chunk changed docs with generic provider-aware metadata
   - delete prior vectors by `document_uid`
   - re-embed and upsert into Pinecone
   - persist document sync state in Postgres
5. Full sync also marks missing source documents as deleted and removes their vectors.
6. Sync run counts and status are persisted for observability and admin reporting.

## Configuration
- Required BookStack settings:
  - `BOOKSTACK_URL`
  - `BOOKSTACK_TOKEN_ID`
  - `BOOKSTACK_TOKEN_SECRET`
- Provider/source defaults:
  - `BOOKSTACK_SOURCE_KEY`
  - `BOOKSTACK_SOURCE_NAME`
- Vector storage:
  - `PINECONE_INDEX_NAME`
  - `DOCUMENT_VECTOR_NAMESPACE`
- Sync tuning:
  - `SYNC_INTERVAL_MINUTES`
  - `CHUNK_SIZE`
  - `CHUNK_OVERLAP`

## Adding Another Provider Later
1. Implement `DocumentProvider`.
2. Map provider-native source data into `DocumentReference` and `NormalizedDocument`.
3. Register or bootstrap a `document_sources` row for that provider instance.
4. Reuse `DocumentSyncService`, `TextProcessor`, `EmbeddingClient`, `VectorStore`, and `RAGService`.

## Known Limitations
- Credentials are still env-based for v1 and are not stored per source in Postgres.
- Raw source payloads are not persisted.
- Retrieval access control is not yet enforced from provider-side permissions.
- Admin endpoints still expose BookStack-flavored routes for backward compatibility.
