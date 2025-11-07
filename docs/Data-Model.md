# MemorizedMCP-TS Data Model & Storage Design

## 1. Storage Overview
- **SQLite (WAL mode)** for structured data, metadata, and full-text indices (FTS5).
- **Vectra** for vector embeddings and ANN search collections.
- **Filesystem** for large artefacts (raw documents, chunk exports, backups, transformer cache).

## 2. Database Layout
SQLite database files live under `<data-root>/sqlite/memorized.db`.

### 2.1 Core Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `memories` | Canonical memory records (STM/LTM/Episodic/Semantic/Documentary) | `id TEXT PRIMARY KEY`, `layer TEXT`, `content TEXT`, `metadata JSON`, `created_at INTEGER`, `updated_at INTEGER`, `importance REAL`, `session_id TEXT`, `episode_id TEXT`, `summary TEXT` |
| `memory_refs` | Links memories to documents/entities | `memory_id TEXT`, `doc_id TEXT`, `chunk_id TEXT`, `score REAL`, `relation TEXT` |
| `episodes` | Episodic containers for conversations/tasks | `id TEXT PRIMARY KEY`, `name TEXT`, `session_id TEXT`, `metadata JSON`, `created_at INTEGER` |
| `documents` | Stored documents with metadata | `id TEXT PRIMARY KEY`, `hash TEXT UNIQUE`, `source_path TEXT`, `mime TEXT`, `title TEXT`, `metadata JSON`, `ingested_at INTEGER`, `size_bytes INTEGER` |
| `doc_chunks` | Chunked document segments | `id TEXT PRIMARY KEY`, `doc_id TEXT`, `position_start INTEGER`, `position_end INTEGER`, `page INTEGER`, `content TEXT`, `summary TEXT`, `embedding_id TEXT`, `metadata JSON` |
| `entities` | Knowledge graph entity registry | `id TEXT PRIMARY KEY`, `name TEXT UNIQUE`, `type TEXT`, `count INTEGER`, `first_seen INTEGER`, `last_seen INTEGER`, `tags JSON` |
| `kg_edges` | Typed relationships between nodes | `id TEXT PRIMARY KEY`, `src TEXT`, `dst TEXT`, `relation TEXT`, `weight REAL`, `created_at INTEGER`, `metadata JSON` |
| `tags` | Global tag registry (optional descriptions) | `name TEXT PRIMARY KEY`, `description TEXT` |
| `memory_metrics` | Rolling metrics for search performance | `timestamp INTEGER`, `query_ms REAL`, `cache_hit BOOLEAN`, `result_count INTEGER` |
| `jobs` | Background job metadata | `name TEXT PRIMARY KEY`, `last_run INTEGER`, `status TEXT`, `metadata JSON` |

### 2.2 Indices
- `memories(layer, created_at)` for layer scans.
- `memories(session_id)` and `memories(episode_id)` for episodic queries.
- `memory_refs(memory_id)` and `memory_refs(doc_id)` for fast joins.
- `doc_chunks(doc_id, position_start)` for retrieval ordering.
- `kg_edges(src)` and `kg_edges(dst)` for graph traversals.
- Foreign keys enforce referential integrity (enabled via `PRAGMA foreign_keys = ON`).

### 2.3 FTS5 Virtual Tables
| Table | Definition | Notes |
|-------|------------|-------|
| `fts_memories` | `CREATE VIRTUAL TABLE fts_memories USING fts5(content, summary, layer, tokenize='porter');` | Mirror `memories` content & summary fields. |
| `fts_doc_chunks` | `CREATE VIRTUAL TABLE fts_doc_chunks USING fts5(content, doc_id, chunk_id, tokenize='porter');` | Supports document search & snippet retrieval. |
| `fts_entities` | `CREATE VIRTUAL TABLE fts_entities USING fts5(name, type, tags);` | Enables entity keyword search. |

FTS tables updated via triggers on base tables to ensure synchronization.

## 3. Vector Storage (Vectra)
- **Collection**: `memories` for aggregated memory embeddings (centroid/summary).
- **Collection**: `doc_chunks` storing chunk embeddings keyed by `chunk_id`.
- **Vector dimension**: Derived from Transformers.js model (e.g., 768 for `Xenova/all-MiniLM-L6-v2`).
- **Metadata**: Each vector entry includes JSON payload with references (`memory_id`, `doc_id`, `layer`, `importance`).
- **Persistence**: Vectra data resides under `<data-root>/vectors/` with collection manifests committed to disk.

### 3.1 Interaction Flow
1. Memory or document chunk is created/updated.
2. Transformers.js generates embedding.
3. Vector stored in corresponding Vectra collection.
4. Embedding ID persisted back to SQLite (`memories.embedding_id` or `doc_chunks.embedding_id`).
5. Hybrid searches query Vectra first, then hydrate results via SQLite joins and FTS scoring.

## 4. Knowledge Graph Representation
- Nodes represented by rows in `entities`, `documents`, `memories`, and `episodes` tables.
- Edges stored in `kg_edges` with `src`/`dst` referencing node IDs (namespaced as `Entity::Name`, `Document::ID`, etc.).
- Tagging uses `tags` + `entities.tags` JSON array for quick retrieval.
- Compromise NLP outputs entity candidates with types (person/org/location/concept); deduplicated via normalized name keys.

## 5. Filesystem Assets
| Path | Description |
|------|-------------|
| `<data-root>/documents/original/{docId}` | Original binary/text file. |
| `<data-root>/documents/chunks/{docId}/{chunkId}.json` | Chunk metadata + embeddings cache (optional). |
| `<data-root>/cache/transformers` | Transformers.js model cache. |
| `<data-root>/backups/{timestamp}` | Snapshot exports (SQLite dump + vector manifests + docs). |
| `<data-root>/logs` | Rotated log files if file logging enabled. |

## 6. Caching & Buffering
- In-memory LRU caches for:
  - Recent search results (keyed by normalized query).
  - Entity lookups (name → entity ID).
  - Document chunk metadata (chunk ID → structure).
- Optional `hot` tier caches stored in Bun `Map` objects with TTL.

## 7. Data Lifecycle & Maintenance
- **STM pruning**: `node-cron` job checks `memories` for STM entries exceeding expiration and demotes or deletes after consolidation.
- **LTM consolidation**: Batch job promotes high-importance STM entries, merges duplicates, refreshes embeddings, and updates KG edges.
- **Embedding validation**: Scheduled job re-embeds stale records (based on `updated_at`) to keep vectors consistent.
- **FTS vacuum**: Periodic `OPTIMIZE` and `REBUILD` for FTS5 tables to control index size.
- **Backups**: Snapshot job exports SQLite `.db`, Vectra collection manifests/data, and documents into timestamped directories.

## 8. Migration & Import
- Migration scripts will read legacy sled/tantivy data and populate SQLite/Vectra equivalents using export files.
- Imports leverage streaming pipelines to avoid locking (begin transaction, batch insert, commit per chunk).

## 9. Data Access Patterns
- Services interact through repository layer functions (e.g., `MemoryRepository.findById`, `DocumentRepository.listChunks`).
- Repositories ensure consistent transactions and trigger FTS updates.
- Hybrid search orchestrator merges scores:
  - Normalizes Vectra cosine similarity.
  - Combines FTS relevance and KG edge weights.
  - Applies layer-specific boosts (e.g., STM priority for recent sessions).

## 10. Schema Governance
- Zod schemas define payloads for insert/update operations.
- Database migrations managed via lightweight SQL scripts versioned in `sql/migrations/*.sql` (future work noted in roadmap).
- Any schema change requires synchronized updates to Zod definitions and generated MCP schemas.
