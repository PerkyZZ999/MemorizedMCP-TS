# MemorizedMCP-TS API & Tool Specification

## 1. Tool Modes
- **Single-tool (default)**
  - Tool name: `run_code`
  - Description: Executes TypeScript code within a sandbox that exposes generated client bindings (`client.memory.add`, `client.document.store`, etc.).
  - Request schema:
    ```json
    {
      "type": "object",
      "properties": {
        "code": { "type": "string", "description": "Async TypeScript snippet to execute (IIFE wrapped)." },
        "timeoutMs": { "type": "integer", "minimum": 1000, "maximum": 600000 }
      },
      "required": ["code"],
      "additionalProperties": false
    }
    ```
  - Response: Captured `console.log` output and optional structured result emitted by the snippet.
  - Security: Sandbox denies outbound network access and limits CPU/memory via Bun workers.

- **Multi-tool fallback**
  - Controlled by `MCP_MULTI_TOOL` environment variable.
  - Registers discrete tools described below, sharing validation logic with single-tool bindings.

## 2. Tool Registry (Fallback Mode)
| Tool | Description |
|------|-------------|
| `memory.add` | Add a memory record with optional metadata, relationships, and layer hints. |
| `memory.search` | Perform hybrid search across vector, graph, and text indices. |
| `memory.update` | Update memory content, metadata, or layer assignments. |
| `memory.delete` | Remove memory entries with safety checks and optional backups. |
| `document.store` | Ingest documents from files or inline content, extracting chunks/entities. |
| `document.retrieve` | Fetch stored document metadata/content. |
| `document.analyze` | Return summaries, entity highlights, and related memories. |
| `document.refs_for_memory` | List document references linked to a memory. |
| `document.refs_for_document` | List memories referencing a document. |
| `document.validate_refs` | Validate/repair documentary references. |
| `kg.list_entities` | List top entities with counts. |
| `kg.get_entity` | Retrieve entity detail, associated docs/memories, relationships. |
| `kg.create_entity` | Ensure entity exists with optional metadata/tags. |
| `kg.create_relation` | Add relation between two nodes. |
| `kg.search_nodes` | Search KG nodes by type/pattern. |
| `kg.read_graph` | Snapshot subset of graph with filters. |
| `kg.tag_entity` | Add tags to an entity. |
| `kg.get_tags` | Retrieve available tags. |
| `kg.remove_tag` | Remove tags from an entity. |
| `kg.delete_entity` | Delete entity and dependent edges. |
| `kg.delete_relation` | Delete specific relation edge. |
| `advanced.consolidate` | Run STM→LTM consolidation pipeline. |
| `advanced.analyze_patterns` | Pattern mining across memories. |
| `advanced.reindex` | Rebuild vector/FTS indices. |
| `advanced.trends` | Time-bucketed metrics over memory activity. |
| `advanced.clusters` | Cluster analysis using document/entity signals. |
| `advanced.relationships` | Relationship strength analytics. |
| `advanced.effectiveness` | Memory effectiveness scoring. |
| `system.status` | Report uptime, resource stats, storage usage. |
| `system.cleanup` | Run cleanup tasks (orphan removal, cache purge). |
| `system.backup` | Trigger snapshot backup. |
| `system.restore` | Restore from backup package. |
| `system.compact` | Compact storage and vacuum databases. |
| `system.validate` | Run integrity checks. |
| `data.export` | Export data subset. |
| `data.import` | Import data package. |

## 3. Schema Strategy
- **Validation**: Zod schemas defined in `src/schemas/*.ts`; conversions to JSON Schema via `zod-to-json-schema` for MCP registration.
- **Versioning**: Each schema namespaced (e.g., `MemoryAddInput_v1`) allowing non-breaking evolution via new versions.
- **Error format**: Uniform structure:
  ```json
  {
    "error": {
      "code": "INVALID_INPUT",
      "message": "Missing required field: content",
      "details": { "field": "content" }
    }
  }
  ```
  with HTTP-equivalent status codes mapped to MCP error types.

## 4. Representative Schemas
### 4.1 Memory Add
Zod definition (simplified):
```ts
const MemoryAddInput = z.object({
  content: z.string().min(1),
  layerHint: z.enum(['stm', 'ltm', 'episodic', 'semantic', 'documentary']).optional(),
  metadata: z.record(z.any()).optional(),
  importance: z.number().min(0).max(1).default(0.5),
  sessionId: z.string().optional(),
  episodeId: z.string().optional(),
  references: z.array(z.object({
    docId: z.string(),
    chunkId: z.string().optional(),
    score: z.number().optional(),
    relation: z.string().optional()
  })).optional()
});
```
Response schema captures generated ID, persisted layer, timestamps, and any consolidation actions triggered.

### 4.2 Memory Search
```ts
const MemorySearchInput = z.object({
  query: z.string().min(1),
  topK: z.number().min(1).max(100).default(20),
  filter: z.object({
    layers: z.array(z.string()).optional(),
    sessionId: z.string().optional(),
    episodeId: z.string().optional(),
    tag: z.string().optional(),
    dateRange: z.object({ from: z.coerce.date(), to: z.coerce.date() }).optional()
  }).optional(),
  include: z.object({
    docRefs: z.boolean().default(true),
    entities: z.boolean().default(true),
    explanations: z.boolean().default(false)
  }).optional()
});
```
Results embed hybrid scores (`vectorScore`, `textScore`, `graphScore`, `combinedScore`) and highlight snippets.

### 4.3 Document Store
```ts
const DocumentStoreInput = z.object({
  path: z.string().optional(),
  mime: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  hashOverride: z.string().optional(),
  options: z.object({
    chunkSize: z.number().default(800),
    chunkOverlap: z.number().default(60),
    generateSummary: z.boolean().default(true),
    detectEntities: z.boolean().default(true)
  }).default({})
}).refine((value) => value.path || value.content, {
  message: 'Provide either path or content'
});
```
Response returns `docId`, `hash`, `chunkCount`, and list of generated chunk IDs.

### 4.4 Knowledge Graph Create Relation
```ts
const CreateRelationInput = z.object({
  src: z.string(),
  dst: z.string(),
  relation: z.string(),
  weight: z.number().optional(),
  metadata: z.record(z.any()).optional()
});
```

## 5. Configuration Parameters (Environment)
| Variable | Description |
|----------|-------------|
| `MCP_MULTI_TOOL` | `true` to expose discrete tools; default `false` (single-tool). |
| `DATA_ROOT` | Filesystem root for SQLite, vectors, documents. |
| `SQLITE_URL` | Optional custom path/URI; falls back to `<DATA_ROOT>/sqlite/memorized.db`. |
| `TRANSFORMER_MODEL` | HuggingFace model identifier for Transformers.js. |
| `VECTRA_COLLECTION_MEM` | Override vector collection name for memories. |
| `VECTRA_COLLECTION_DOC` | Override vector collection name for document chunks. |
| `SINGLE_TOOL_TIMEOUT_MS` | Default timeout for sandbox execution. |
| `CRON_CONSOLIDATE` | CRON expression for consolidation job. |
| `CRON_BACKUP` | CRON expression for backups. |
| `LOG_LEVEL` | Pino log level (info/debug/warn/error). |

## 6. Capability Metadata
- Server advertises:
  - `instructions` endpoint describing tool usage patterns and sandbox constraints.
  - Resource discovery (documents, skills) for future expansion.
  - Optional elicitation support if host supports interactive prompts.

## 7. Testing Strategy
- Contract tests validate Zod schemas against stored JSON Schema snapshots.
- Integration tests run both modes (single-tool & multi-tool) asserting identical outcomes.
- Regression tests ensure schema changes remain backward-compatible (e.g., additive updates only, field deprecation flagged).
