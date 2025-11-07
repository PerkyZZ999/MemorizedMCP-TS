# MemorizedMCP-TS Architecture

## 1. High-Level Topology
```
MCP Host (Cursor / VS Code / Custom)
        │
        │  Protocol: MCP 2025-11-05 (stdio default, optional Streamable HTTP)
        ▼
Bun Runtime ── @modelcontextprotocol/sdk Server
        │
        ├── Tool Adapter Layer (single-tool + multi-tool fallback)
        │
        ├── Execution Sandbox (TypeScript VM bindings)
        │
        └── Application Services
              ├─ MemoryService
              ├─ DocumentService
              ├─ KnowledgeGraphService
              ├─ SearchService
              ├─ AnalyticsService
              ├─ SystemService
              └─ JobScheduler
```

## 2. Transport & Tool Strategy
- **Primary transport**: stdio via `@modelcontextprotocol/sdk` for maximum compatibility; Streamable HTTP/WebSocket can be added behind feature flags.
- **Single-tool mode**:
  - Exposes one MCP tool (`run_code`) that executes user/LLM TypeScript inside an isolated VM with bindings to generated clients for each service.
  - Enabled by default to minimize token usage and align with "code-mode" workflows.
- **Multi-tool fallback**:
  - Environment variable `MCP_MULTI_TOOL=true` switches the server to register discrete tools (e.g., `memory.add`, `document.store`).
  - Tool definitions generated from shared JSON Schemas validated by Zod, ensuring parity between single-tool bindings and fallback RPC endpoints.
- **Sandbox isolation**:
  - VM denies network access unless explicitly configured.
  - Binds typed service clients that proxy requests to internal business logic.
  - Captures console output and structured responses for MCP replies.

## 3. Module Breakdown
- **Bootstrap Layer**
  - Loads config (.env + bunfig), initializes logging (Pino), and constructs the MCP server.
  - Registers transports, capability metadata, and server instructions.

- **Tool Adapter Layer**
  - Generates TypeScript client bindings (namespace per service) from Zod schemas at startup.
  - Single-tool mode uses adapters to invoke service methods dynamically.
  - Multi-tool mode maps each tool name to service handlers, sharing validation and error-path logic.

- **Application Services**
  1. `MemoryService`
     - Handles CRUD for memories, layer management (STM/LTM/Episodic/Semantic/Documentary), and consolidation heuristics.
  2. `DocumentService`
     - Manages ingestion, parsing (unpdf), chunking, storage, and retrieval of documents and summaries.
  3. `KnowledgeGraphService`
     - Maintains entity and relationship records using compromise NLP outputs.
  4. `SearchService`
     - Orchestrates hybrid retrieval across Vectra, SQLite FTS5, and KG features.
  5. `AnalyticsService`
     - Provides insights (patterns, clusters, effectiveness, trends) powered by SQL queries and vector analytics.
  6. `SystemService`
     - Status endpoints, health, backups, import/export, and configuration introspection.
  7. `JobScheduler`
     - Coordinates `node-cron` jobs for consolidation, cleanup, reindexing, backups, and embedding refresh.

- **Repositories / Data Access**
  - SQLite repositories (WAL mode) for structured data and FTS5 indices.
  - Vectra for vector storage and ANN queries.
  - Filesystem-backed blob storage for raw documents and transformed artefacts.

- **Shared Utilities**
  - Zod schema definitions and helper factories.
  - Error normalization layer returning MCP-compliant error payloads.
  - Caching (in-memory LRU) for hot query results and embeddings.

## 4. Deployment & Environment Layout
- Default data directory structure (configurable):
```
<data-root>/
  ├─ sqlite/           # primary database + WAL files
  ├─ vectors/          # Vectra collections & metadata
  ├─ documents/        # original files, chunk JSON, summaries
  ├─ cache/            # transformer model cache, temp artefacts
  └─ backups/          # periodic snapshots & exports
```
- Bun entry point `src/index.ts` bootstraps server; builds to `dist/server.js` for deployment.
- Supports optional systemd or PM2 process management; docs will outline commands.

## 5. Sequence Overview
### Example: Memory Search via Single-Tool Mode
1. Host invokes `run_code` with TypeScript snippet calling `client.memory.search({ ... })`.
2. Sandbox validates code, injects generated client, and executes snippet.
3. Client binding invokes `MemoryService.search()` via adapter.
4. `MemoryService` delegates to `SearchService` for hybrid retrieval.
5. Results merged, annotated with doc references/entities, returned to sandbox.
6. Sandbox serializes output (console logs + structured payload) to MCP response.

### Example: Document Ingestion via Multi-Tool Mode
1. Host calls `document.store` tool with file path & metadata.
2. `DocumentService` reads file, runs `unpdf`, chunks content, extracts entities, and stores records via repositories.
3. Embeddings generated via Transformers.js, vectors stored in Vectra, FTS5 indices updated.
4. Knowledge graph updated with entities, relationships, and doc references.
5. Response returns document ID, hash, chunk count.

## 6. Extensibility Notes
- New services can be added by extending the generated client namespace and registering additional tools.
- Transport abstraction allows dropping in HTTP server or background worker processes without reworking core services.
- Schema-driven approach (Zod + codegen) ensures future API changes propagate to both modes consistently.
