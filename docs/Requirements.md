# MemorizedMCP-TS Requirements

## 1. Purpose & Goals
- Deliver a Bun + TypeScript rewrite of the Memorized MCP server that preserves the hybrid memory capabilities of the original Rust implementation while aligning with modern MCP "code-as-interface" patterns for lower token usage.
- Provide a single-tool execution experience (sandboxed TypeScript client) with an environment-controlled fallback that exposes the full tool registry for traditional MCP hosts.
- Maintain full parity with the existing memory/document/knowledge-graph operations so downstream agents and workflows migrate without regressions.

## 2. Scope
- **In scope**: MCP server implementation, data persistence, document ingestion, search/indexing, knowledge graph enrichment, background jobs, observability, configuration, deployment guidance, and documentation.
- **Out of scope**: Front-end UI, hosted embedding APIs (unless explicitly configured), alternative language runtimes, and non-TypeScript SDK integrations.

## 3. Stakeholders
- Core engineers maintaining MemorizedMCP.
- AI agents (Cursor, VS Code MCP, custom hosts) connecting via MCP transports.
- Operators running the service locally or in controlled environments.

## 4. Functional Requirements
1. **Transport & Connection**
   - Provide stdio MCP transport via `@modelcontextprotocol/sdk` with optional WebSocket/HTTP extensions.[^ts_sdk]
   - Support capability negotiation for single-tool or multi-tool mode via environment variables.
2. **Tool Surfaces**
   - Single primary tool (`run_code`) that grants sandboxed access to generated TypeScript client helpers.
   - Fallback registry exposing discrete tools (memory, document, KG, analytics, system) mirroring the Rust endpoints for compatibility.
3. **Memory Operations**
   - Add, search, update, delete memories with hybrid ranking (vector + graph + text) and document references.
   - Manage short-term vs. long-term memory layers, episodic/semantic/documentary distinctions, and consolidation workflows.
4. **Document Operations**
   - Store documents from inline content or file paths, extract text via `unpdf`, chunk, embed, and link to memories.[^unpdf]
   - Retrieve, analyze, and validate document references; export/import datasets.
5. **Knowledge Graph & Entities**
   - Extract entities using `compromise` NLP, manage nodes/edges/tags, and expose search/list APIs.[^compromise]
6. **Vector & Text Search**
   - Generate embeddings using Transformers.js, persist vectors via Vectra, and perform hybrid retrieval with SQLite FTS5 indices.[^transformers][^vectra][^fts5]
7. **Background Tasks**
   - Schedule maintenance (consolidation, reindexing, cleanup, backups) with `node-cron`.
8. **Configuration & Secrets**
   - Load configuration from `.env` and `bunfig.toml`, validating required settings at startup.
9. **Observability**
   - Emit structured logs with Pino and expose status/metrics endpoints or tools for operators.
10. **Documentation**
    - Provide architecture, data model, API specification, and operations guides in `MemorizedMCP-TS/docs/`.

## 5. Non-Functional Requirements
- **Performance**: Comparable retrieval latency to the Rust version for typical workloads; vector search must return top-k within acceptable latency (<250ms on dev hardware). Batch document ingestion must remain responsive by using Bun workers or asynchronous pipelines.
- **Scalability**: Support datasets up to tens of thousands of memories/documents on commodity hardware; ensure Vectra and SQLite configurations allow growth without manual tuning.
- **Reliability**: Graceful shutdown, crash-safe persistence, and automated recovery of background tasks; comprehensive error handling with structured responses.
- **Security & Privacy**: Local-first storage, optional tokenization hooks, controlled execution sandbox (single tool) preventing arbitrary network access unless configured.
- **Maintainability**: Modular TypeScript services with Zod-validated schemas, unit/integration tests, and clear separation of concerns (transport, services, repositories, jobs).
- **Configurability**: Environment-driven toggles for tool exposure, persistence paths, model selection, job schedules, and logging levels.
- **Observability**: Log correlation IDs per request/tool invocation; optional Prometheus-compatible metrics for memory/search performance.

## 6. Constraints & Assumptions
- Bun runtime is available on deployment targets; Node compatibility is secondary.
- SQLite operates in WAL mode with FTS5 enabled; file-based storage resides under a configurable data directory.
- Transformers.js models are cached locally to avoid repeated downloads; fallback remote embeddings can be integrated later.
- Vectra library provides required ANN features in-process; no external vector DB is assumed.
- MCP clients may not support single-tool mode; fallback tooling must remain functional via configuration.

## 7. Success Criteria
- All functional requirements implemented and validated through documented test scenarios.
- Documentation set (Requirements, Architecture, Data Model, API, Operations) completed and kept in sync with code base.
- Single-tool strategy demonstrably reduces prompt/tool token usage in supported hosts while preserving legacy compatibility.
- Migration path from Rust server established (data conversion scripts or clear instructions).

[^ts_sdk]: [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
[^vectra]: [Stevenic/vectra](https://github.com/Stevenic/vectra)
[^transformers]: [huggingface/transformers.js](https://github.com/huggingface/transformers.js)
[^unpdf]: [unjs/unpdf](https://github.com/unjs/unpdf)
[^compromise]: [spencermountain/compromise](https://github.com/spencermountain/compromise)
[^fts5]: [SQLite FTS5 documentation](https://sqlite.org/fts5.html)
