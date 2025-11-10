# MemorizedMCP-TS Server Guide
This guide provides an overview of the MemorizedMCP-TS server and its capabilities.  
> **Compatibility note:** The server has been validated with Cursor 2.0. Other MCP hosts may require additional setup or testing.
---

## Overview

MemorizedMCP-TS is a Model Context Protocol (MCP) server that provides hybrid memory, document management, and knowledge graph capabilities. It operates in two distinct modes:

- **Single-Tool Mode** (default): Exposes one `run_code` tool that executes TypeScript snippets with pre-bound service clients
- **Multi-Tool Mode**: Exposes discrete tools for each operation (memory.add, document.store, etc.)

The server runs on Bun runtime, uses SQLite for structured data, Vectra for vector embeddings, and provides full-text search via FTS5.

---

## How the MCP Server Works

### Architecture Flow

```
MCP Host (Cursor/VS Code/Custom Client)
        │
        │ stdio transport (JSON-RPC)
        ▼
@modelcontextprotocol/sdk Server
        │
        ├─── Tool Registration Layer
        │    ├─ run_code (always)
        │    └─ discrete tools (if MCP_MULTI_TOOL=true)
        │
        ├─── Execution Layer
        │    ├─ Sandbox (for run_code)
        │    └─ Direct Service Calls (for multi-tool)
        │
        └─── Service Layer
             ├─ MemoryService
             ├─ DocumentService
             ├─ KnowledgeGraphService
             ├─ SearchService
             ├─ AnalyticsService
             └─ SystemService
```

### Communication Protocol

The server uses the MCP protocol over stdio:
- **Input**: JSON-RPC requests from MCP host
- **Output**: JSON-RPC responses with structured content
- **Transport**: Standard input/output streams
- **Format**: Each tool call includes input validation, execution, and structured response

---

## Tool Modes

### Mode Selection

The tool mode is controlled by the `MCP_MULTI_TOOL` environment variable:

```bash
# Single-tool mode (default)
MCP_MULTI_TOOL=false

# Multi-tool mode
MCP_MULTI_TOOL=true
```

You can flip modes on the published npm package using CLI flags:

```bash
# Force multi-tool mode via the CLI
npx -y @perkyzz999/memorizedmcp-ts --multi-tool

# Force single-tool mode
npx -y @perkyzz999/memorizedmcp-ts --single-tool

# Load a custom .env file and inject overrides
npx -y @perkyzz999/memorizedmcp-ts --config ~/.memorized/.env.production --env LOG_LEVEL=debug
```

### When to Use Each Mode

**Single-Tool Mode** is ideal when:
- You want to minimize token usage in LLM prompts
- Your MCP host supports code execution patterns
- You need flexible, programmatic access to multiple operations
- You want to compose complex workflows in a single call

**Multi-Tool Mode** is ideal when:
- Your MCP host doesn't support single-tool patterns
- You need explicit, discrete tool calls
- You want simpler, more predictable tool invocations
- You're migrating from traditional RPC-style APIs

---

## Single-Tool Mode (run_code)

### Overview

Single-tool mode exposes a single `run_code` tool that executes TypeScript code in a sandboxed environment with pre-bound service clients.

### How It Works

1. **Code Submission**: MCP host sends TypeScript code as a string
2. **Transpilation**: Bun transpiles TypeScript to JavaScript
3. **Sandbox Creation**: Creates isolated execution context
4. **Service Binding**: Injects typed service clients into sandbox
5. **Execution**: Runs code with timeout protection
6. **Output Capture**: Captures console logs and return values
7. **Response**: Returns structured result with logs and data

### Sandbox Environment

The sandbox provides:
- **Isolated execution**: No access to filesystem or network (unless explicitly configured)
- **Timeout protection**: Configurable timeout (default: 120 seconds)
- **Console capture**: All console.log/info/warn/error calls are captured
- **Service bindings**: Pre-configured clients for all services
- **Error handling**: Graceful error capture and reporting

### Available Bindings

Inside the `run_code` sandbox, you have access to:

```typescript
services.memory.addMemory(...)
services.memory.updateMemory(...)
services.memory.deleteMemory(...)
services.memory.searchMemories(...)
services.memory.getMemory(...)
services.memory.getMemoriesByEntity(...)
services.memory.getMemoriesByDocument(...)

services.document.ingest(...)
services.document.getDocument(...)
services.document.listDocuments(...)
services.document.updateDocument(...)
services.document.deleteDocument(...)
services.document.searchDocuments(...)
services.document.getDocumentReferences(...)
services.document.analyzeDocument(...)

services.knowledge.ensureEntities(...)
services.knowledge.listEntities(...)
services.knowledge.getEntity(...)
services.knowledge.createEntity(...)
services.knowledge.updateEntity(...)
services.knowledge.deleteEntity(...)
services.knowledge.createRelation(...)
services.knowledge.getEntityRelations(...)
services.knowledge.deleteRelation(...)
services.knowledge.searchRelations(...)
services.knowledge.searchEntities(...)
services.knowledge.getEntitiesByType(...)
services.knowledge.getEntitiesByTag(...)
services.knowledge.tagEntity(...)
services.knowledge.removeTag(...)
services.knowledge.getTags(...)
services.knowledge.readGraph(...)
services.knowledge.getRelatedEntities(...)
services.knowledge.findPath(...)
services.knowledge.getEntityContext(...)
services.knowledge.getEntitiesInDocument(...)
services.knowledge.getEntitiesInMemory(...)

services.search.searchMemories(...)
services.analytics.recordMetric(...)
services.analytics.listRecentMetrics(...)
services.system.status(...)
```

### Tool Schema

**Input:**
```json
{
  "code": "string (required)",
  "timeoutMs": "number (optional, 100-600000)"
}
```

**Output:**
```json
{
  "result": "any (return value from code)",
  "logs": ["array of captured console output"]
}
```

### Security & Limitations

- **Network access**: Denied by default
- **Filesystem access**: Limited to service-provided operations
- **CPU/Memory**: Controlled by Bun worker limits
- **Timeout**: Enforced to prevent infinite loops
- **Transpilation errors**: Caught and reported before execution

### When to Use run_code

Use `run_code` when you need to:
- Perform multiple operations in sequence
- Implement custom logic or filtering
- Combine data from multiple services
- Process results before returning
- Execute conditional workflows
- Batch operations efficiently

### Example Workflow

```typescript
// Inside run_code
const memory = await services.memory.addMemory({
  content: "User prefers dark mode",
  layer: "semantic",
  importance: 0.8
});

const results = await services.memory.searchMemories({
  query: "user preferences",
  topK: 5
});

console.log(`Found ${results.length} related memories`);

return {
  memoryId: memory.id,
  relatedCount: results.length
};
```

---

## Multi-Tool Mode

### Overview

Multi-tool mode exposes discrete tools for each operation, following traditional RPC patterns. Each tool has explicit input/output schemas and performs a single operation.

### How It Works

1. **Tool Registration**: Server registers all discrete tools at startup
2. **Tool Invocation**: MCP host calls specific tool by name
3. **Input Validation**: Zod schemas validate input parameters
4. **Service Execution**: Direct call to corresponding service method
5. **Output Formatting**: Results formatted as structured content
6. **Response**: Returns JSON-RPC response with tool output

### Available Tools

Multi-tool mode exposes the following tools:

#### Memory Tools
- `memory.add` – Add a memory entry
- `memory.search` – Hybrid search across memory index
- `memory.get` – Retrieve a memory by ID
- `memory.get_by_entity` – List memories mentioning an entity (FTS-backed)
- `memory.get_by_document` – List memories referencing a document

#### Document Tools
- `document.store` – Ingest and process documents
- `document.retrieve` – Get document plus chunks by ID
- `document.list` – Paginated list of recent documents
- `document.update` – Update document metadata/title
- `document.delete` – Delete document and its chunks
- `document.search` – Search documents via chunk FTS
- `document.get_references` – Fetch memories that reference a document
- `document.analyze` – Summarize document stats and entities

#### Knowledge Graph Tools
- `knowledge.list_entities` – List entities with counts
- `knowledge.get_entity` – Retrieve entity detail + relation counts
- `knowledge.create_entity` – Manually upsert entity
- `knowledge.update_entity` – Update entity fields/tags
- `knowledge.delete_entity` – Remove entity and relations
- `knowledge.create_relation` – Create edges between entities
- `knowledge.get_relations` – List relations for an entity
- `knowledge.delete_relation` – Remove relation by ID
- `knowledge.search_relations` – Filter relations (by type)
- `knowledge.search_entities` – FTS/entity filter by name/type/tag
- `knowledge.get_entities_by_type` – List entities for a type
- `knowledge.get_entities_by_tag` – List entities with a tag
- `knowledge.tag_entity` / `knowledge.remove_tag` / `knowledge.get_tags`
- `knowledge.read_graph` – BFS neighborhood snapshot
- `knowledge.get_related_entities` – Direct neighbors (1 hop)
- `knowledge.find_path` – Shortest path between entities (BFS)
- `knowledge.get_entity_context` – Documents/memories referencing entity
- `knowledge.get_entities_in_document` – Extract entities from a document
- `knowledge.get_entities_in_memory` – Extract entities from a memory

#### System Tools
- `system.status` - Report system health and statistics

### Tool Invocation Pattern

Each tool follows this pattern:

1. **Input Validation**: Zod schema validates parameters
2. **Service Call**: Delegates to appropriate service method
3. **Result Formatting**: Structures output according to schema
4. **Response**: Returns both text and structured content

### When to Use Multi-Tool Mode

Use multi-tool mode when:
- Your MCP host requires explicit tool definitions
- You want predictable, single-operation calls
- You're building integrations with traditional RPC clients
- You need clear separation between operations
- You want to leverage MCP host's tool selection UI

---

## Available Services & Operations

### MemoryService

Manages memory records across different layers (STM, LTM, Episodic, Semantic, Documentary).

**Operations:**
- `addMemory(input)` – Create new memory with embeddings
- `updateMemory(id, patch)` – Update memory content/metadata
- `deleteMemory(id)` – Remove memory and its vectors
- `searchMemories(request)` – Hybrid search across memories
- `getMemory({ id })` – Retrieve full memory with references
- `getMemoriesByEntity({ entityId, ... })` – FTS query for entity mentions
- `getMemoriesByDocument({ docId, ... })` – Memories referencing a document

**Memory Layers:**
- `stm` - Short-term memory (recent, temporary)
- `ltm` - Long-term memory (consolidated, permanent)
- `episodic` - Event-based memories (conversations, sessions)
- `semantic` - Conceptual knowledge (facts, relationships)
- `documentary` - Document-linked memories (references)

### DocumentService

Handles document ingestion, chunking, and retrieval.

**Operations:**
- `ingest(request)` – Process and store documents
  - Reads from file path or inline content
  - Chunks text with configurable size/overlap
  - Generates embeddings for each chunk
  - Extracts entities (optional)
  - Creates summaries (optional)
- `getDocument(id)` – Retrieve document with chunks
- `listDocuments(limit, offset)` – Paginated document list
- `updateDocument({ id, ... })` – Update metadata/title without re-ingest
- `deleteDocument({ id })` – Remove document and chunks
- `searchDocuments({ query, ... })` – FTS5 search on chunk content
- `getDocumentReferences({ docId })` – Related memories referencing the doc
- `analyzeDocument({ docId })` – High-level stats and entity extraction snapshot

**Document Processing:**
1. Load content (file or inline)
2. Hash content for deduplication
3. Split into chunks (sliding window)
4. Generate embeddings (Transformers.js)
5. Extract entities (compromise NLP)
6. Store in SQLite + Vectra
7. Update knowledge graph

### KnowledgeGraphService

Manages entities and relationships extracted from documents and memories.

**Operations:**
- `ensureEntities(entities, context)` – Upsert entities with context
- `listEntities(limit, offset)` – Get top entities by count
- `getEntity(request)` – Detailed entity view with relation counts
- `createEntity(request)` / `updateEntity(request)` / `deleteEntity(request)`
- `createRelation(request)` / `getEntityRelations(request)` / `deleteRelation(request)` / `searchRelations(request)`
- `searchEntities(request)` / `getEntitiesByType(request)` / `getEntitiesByTag(request)`
- `tagEntity(request)` / `removeTag(request)` / `getTags()`
- `readGraph(request)` – Multi-depth BFS snapshot
- `getRelatedEntities(request)` – Direct neighbors
- `findPath(request)` – Shortest path between nodes
- `getEntityContext(request)` – Documents/memories mentioning entity
- `getEntitiesInDocument(request)` / `getEntitiesInMemory(request)` – On-demand extraction

**Entity Types:**
- Person
- Organization
- Location
- Concept
- Other

### SearchService

Orchestrates hybrid search across vector, text, and graph indices.

**Operations:**
- `searchMemories(request)` - Multi-modal memory search

**Search Strategy:**
1. Vector search (Vectra ANN)
2. Full-text search (SQLite FTS5)
3. Graph-based ranking (entity relationships)
4. Score fusion and normalization
5. Layer-specific boosting

### AnalyticsService

Tracks metrics and provides insights.

**Operations:**
- `recordMetric(metric)` - Log search/operation metrics
- `listRecentMetrics(limit)` - Retrieve recent metrics

### SystemService

Provides system health and operational status.

**Operations:**
- `status()` - Health check and statistics
  - Environment info
  - Vectra health (memory/document indices)
  - Vector counts
  - Data root location

---

## Tool Reference

### run_code

**Purpose**: Execute TypeScript code with service bindings

**Input Schema:**
```typescript
{
  code: string;           // TypeScript code to execute
  timeoutMs?: number;     // Optional timeout (100-600000ms)
}
```

**Output Schema:**
```typescript
{
  result?: any;           // Return value from code
  logs: string[];         // Captured console output
}
```

**Example:**
```typescript
{
  "code": "const mem = await services.memory.addMemory({ content: 'test', layer: 'stm' }); return mem.id;",
  "timeoutMs": 30000
}
```

---

### memory.add

**Purpose**: Add a new memory entry

**Input Schema:**
```typescript
{
  content: string;                    // Memory content (required)
  layer: "stm" | "ltm" | "episodic" | "semantic" | "documentary";
  metadata?: Record<string, any>;     // Optional metadata
  importance?: number;                // 0.0-1.0 (default: 0.5)
  sessionId?: string;                 // Session identifier
  episodeId?: string;                 // Episode identifier
  summary?: string;                   // Optional summary
}
```

**Output Schema:**
```typescript
{
  memory: {
    id: string;
    layer: string;
    content: string;
    metadata: Record<string, any>;
    createdAt: number;
    updatedAt: number;
    importance: number;
    sessionId?: string;
    episodeId?: string;
    summary?: string;
    embeddingId?: string;
    references?: Array<{
      docId: string;
      chunkId?: string;
      score?: number;
      relation?: string;
    }>;
  }
}
```

**When to Use:**
- Storing user preferences or facts
- Recording conversation context
- Capturing important information
- Building episodic memory chains

**Example:**
```json
{
  "content": "User prefers TypeScript over JavaScript",
  "layer": "semantic",
  "importance": 0.8,
  "metadata": {
    "category": "preferences",
    "source": "conversation"
  }
}
```

---

### memory.search

**Purpose**: Search memories using hybrid ranking

**Input Schema:**
```typescript
{
  query?: string;                     // Search query text
  queryVector?: number[];             // Pre-computed embedding
  topK?: number;                      // Results to return (1-100, default: 20)
  layers?: string[];                  // Filter by layers
  minImportance?: number;             // Minimum importance (0.0-1.0)
  sessionId?: string;                 // Filter by session
  episodeId?: string;                 // Filter by episode
  includeReferences?: boolean;        // Include doc refs (default: true)
}
```

**Output Schema:**
```typescript
{
  results: Array<{
    id: string;
    layer: string;
    content: string;
    metadata: Record<string, any>;
    createdAt: number;
    updatedAt: number;
    importance: number;
    score: number;                    // Combined score
    vectorScore?: number;             // Cosine similarity
    textScore?: number;               // FTS5 relevance
    graphScore?: number;              // KG-based score
    references?: Array<{...}>;
  }>
}
```

**When to Use:**
- Finding relevant context for queries
- Retrieving related memories
- Building conversation context
- Discovering patterns and connections

**Example:**
```json
{
  "query": "user preferences about programming",
  "topK": 10,
  "layers": ["semantic", "episodic"],
  "minImportance": 0.5
}
```

---

### memory.get

**Purpose**: Retrieve a specific memory record (including references)

**Input Schema:** `{ id: string }`

**Output Schema:** `{ memory?: MemoryRecord }`

**When to Use:** Display memory details, verify updates/deletions, inspect references.

---

### memory.get_by_entity

**Purpose**: List memories that mention a particular entity (FTS-based)

**Input Schema:** `{ entityId: string; limit?: number; offset?: number }`

**Output Schema:** `{ memories: MemoryRecord[] }`

**When to Use:** Contextualize entities with episodic/semantic memories.

---

### memory.get_by_document

**Purpose**: List memories that reference a given document

**Input Schema:** `{ docId: string; limit?: number; offset?: number }`

**Output Schema:** `{ memories: MemoryRecord[] }`

**When to Use:** Trace how documents are referenced in the memory store.

---

### document.store

**Purpose**: Ingest and process documents

**Input Schema:**
```typescript
{
  path?: string;                      // File path (mutually exclusive with content)
  content?: string;                   // Inline content
  mime?: string;                      // MIME type
  metadata?: Record<string, any>;     // Document metadata
  hashOverride?: string;              // Custom hash for deduplication
  references?: Array<{                // Memory references
    docId: string;
    chunkId?: string;
    score?: number;
    relation?: string;
  }>;
  options?: {
    chunkSize?: number;               // Chunk size (100-4000, default: 800)
    chunkOverlap?: number;            // Overlap (0-400, default: 60)
    generateSummary?: boolean;        // Generate summaries (default: true)
    detectEntities?: boolean;         // Extract entities (default: true)
  };
}
```

**Output Schema:**
```typescript
{
  document: {
    id: string;
    hash: string;
    sourcePath?: string;
    mime?: string;
    title?: string;
    metadata: Record<string, any>;
    ingestedAt: number;
    sizeBytes: number;
    chunks: Array<{
      id: string;
      docId: string;
      positionStart: number;
      positionEnd: number;
      page?: number;
      content: string;
      summary?: string;
      embeddingId?: string;
      metadata: Record<string, any>;
    }>;
  };
  chunkCount: number;
  entities?: string[];                // Extracted entity names
}
```

**When to Use:**
- Ingesting documentation
- Processing user-uploaded files
- Building searchable document corpus
- Extracting knowledge from text

**Example:**
```json
{
  "path": "/path/to/document.txt",
  "metadata": {
    "title": "Project Documentation",
    "author": "Team"
  },
  "options": {
    "chunkSize": 1000,
    "chunkOverlap": 100,
    "generateSummary": true,
    "detectEntities": true
  }
}
```

---

### document.retrieve

**Purpose**: Get document by ID with all chunks

**Input Schema:**
```typescript
{
  id: string;                         // Document ID
}
```

**Output Schema:**
```typescript
{
  document: {
    // Same as document.store output
  }
}
```

**When to Use:**
- Retrieving full document content
- Accessing document chunks
- Reviewing ingested documents

---

### document.list

**Purpose**: List recently ingested documents

**Input Schema:**
```typescript
{
  limit?: number;                     // Max results (1-200)
  offset?: number;                    // Pagination offset
}
```

**Output Schema:**
```typescript
{
  documents: Array<{
    // Same structure as document.retrieve
  }>
}
```

**When to Use:**
- Browsing document library
- Pagination through documents
- Listing recent ingestions

---

### knowledge.list_entities

**Purpose**: List knowledge graph entities

**Input Schema:**
```typescript
{
  limit?: number;                     // Max results (1-500)
  offset?: number;                    // Pagination offset
}
```

**Output Schema:**
```typescript
{
  entities: Array<{
    id: string;
    name: string;
    type: string;                     // person, org, location, concept, other
    count: number;                    // Occurrence count
    firstSeen: number;                // Timestamp
    lastSeen: number;                 // Timestamp
    tags: string[];
  }>
}
```

**When to Use:**
- Exploring extracted entities
- Building entity indexes
- Understanding document themes
- Discovering relationships

---

### system.status

**Purpose**: Report system health and statistics

**Input Schema:**
```typescript
{}  // No input required
```

**Output Schema:**
```typescript
{
  status: {
    env: string;                      // Environment (development/production)
    logLevel: string;                 // Current log level
    dataRoot: string;                 // Data directory path
    vectra: {
      ok: boolean;                    // Health check passed
      memoryIndex: boolean;           // Memory index available
      documentIndex: boolean;         // Document index available
      counts: {
        memories: number;             // Vector count
        docChunks: number;            // Chunk count
      }
    }
  }
}
```

**When to Use:**
- Health checks
- Monitoring system state
- Debugging issues
- Verifying configuration

---

## Examples

### Example 1: Single-Tool - Add Memory and Search

```typescript
// Tool: run_code
{
  "code": `
    // Add a new memory
    const memory = await services.memory.addMemory({
      content: "User prefers dark mode and TypeScript",
      layer: "semantic",
      importance: 0.9,
      metadata: {
        category: "preferences",
        timestamp: Date.now()
      }
    });
    
    console.log("Created memory:", memory.id);
    
    // Search for related memories
    const results = await services.memory.searchMemories({
      query: "user preferences",
      topK: 5,
      layers: ["semantic", "episodic"]
    });
    
    console.log(\`Found \${results.length} related memories\`);
    
    return {
      newMemoryId: memory.id,
      relatedMemories: results.map(r => ({
        id: r.id,
        content: r.content,
        score: r.score
      }))
    };
  `
}
```

**Response:**
```json
{
  "result": {
    "newMemoryId": "uuid-here",
    "relatedMemories": [
      {
        "id": "uuid-1",
        "content": "User likes dark themes",
        "score": 0.87
      }
    ]
  },
  "logs": [
    "[log] Created memory: uuid-here",
    "[log] Found 1 related memories"
  ]
}
```

---

### document.update

**Purpose**: Patch document metadata or title without re-ingesting content

**Input Schema:** `{ id: string; metadata?: Record<string, any>; title?: string }`

**Output Schema:** `{ document: DocumentRecord }`

**When to Use:** Adjust metadata (e.g., title/tags) post ingestion.

---

### document.delete

**Purpose**: Remove a document and its chunks

**Input Schema:** `{ id: string }`

**Output Schema:** `{ success: boolean }`

**When to Use:** Clean up outdated or erroneous documents.

---

### document.search

**Purpose**: Full-text search over document chunks

**Input Schema:** `{ query: string; limit?: number; offset?: number }`

**Output Schema:** `{ documents: DocumentRecord[] }`

**When to Use:** Locate documents by content snippets quickly.

---

### document.get_references

**Purpose**: List memories that reference a document

**Input Schema:** `{ docId: string }`

**Output Schema:** `{ memories: MemoryRecord[] }`

**When to Use:** Understand where a document is cited across memories.

---

### document.analyze

**Purpose**: Summarize document stats (entities, chunk count, size)

**Input Schema:** `{ docId: string }`

**Output Schema:** `{ analysis: { document, entityCount, chunkCount, totalSizeBytes, entities? } }`

**When to Use:** Quick health check after ingestion, generate dashboards.

---

### knowledge.get_entity

**Purpose:** Retrieve entity details (including relation counts)

**Input Schema:** `{ id?: string; name?: string }`

**Output Schema:** `{ entity?: KnowledgeEntityDetail }`

---

### knowledge.create_entity / knowledge.update_entity / knowledge.delete_entity

**Purpose:** Manual entity lifecycle management

**Inputs:** Entity name/type/tags (for create/update), `{ id }` for delete  
**Outputs:** `{ entity: KnowledgeEntity }` or `{ success: true }`

---

### knowledge.create_relation / knowledge.get_relations / knowledge.delete_relation / knowledge.search_relations

**Purpose:** Manage relationships between entities

**Input Highlights:**
- `create_relation`: `{ src, dst, relation, weight?, metadata? }`
- `get_relations`: `{ entityId, relationType?, limit? }`
- `delete_relation`: `{ id }`
- `search_relations`: `{ relationType?, limit?, offset? }`

**Outputs:** `{ relation }`, `{ relations: Edge[] }`, `{ success: true }`

---

### knowledge.search_entities / knowledge.get_entities_by_type / knowledge.get_entities_by_tag

**Purpose:** Discover entities via FTS/type/tag filters

**Input Schema:** `{ name?, type?, tags?, limit?, offset? }` etc.  
**Output Schema:** `{ entities: KnowledgeEntity[] }`

---

### knowledge.tag_entity / knowledge.remove_tag / knowledge.get_tags

**Purpose:** Manage entity tagging taxonomy

**Inputs:** `{ entityId, tags[] }`, `{ entityId, tag }`, `{}`  
**Outputs:** `{ entity: KnowledgeEntity }`, `{ tags: string[] }`

---

### knowledge.read_graph / knowledge.get_related_entities / knowledge.find_path

**Purpose:** Graph traversal utilities

- `read_graph`: `{ entityId, depth?, relationType? } → { graph: { entity, relations, neighbors } }`
- `get_related_entities`: `{ entityId, relationType?, limit? } → { entities: [...] }`
- `find_path`: `{ src, dst, maxDepth? } → { path: Edge[] }`

---

### knowledge.get_entity_context / knowledge.get_entities_in_document / knowledge.get_entities_in_memory

**Purpose:** Context extraction across modalities

- `get_entity_context`: `{ entityId } → { documents, memories, chunks }`
- `get_entities_in_document`: `{ docId } → { entities: [...] }`
- `get_entities_in_memory`: `{ memoryId } → { entities: [...] }`

---

### Example 2: Single-Tool - Document Ingestion with Analysis

```typescript
// Tool: run_code
{
  "code": `
    // Ingest a document
    const doc = await services.document.ingest({
      content: "TypeScript is a typed superset of JavaScript...",
      metadata: {
        title: "TypeScript Overview",
        source: "documentation"
      },
      options: {
        chunkSize: 500,
        detectEntities: true
      }
    });
    
    console.log(\`Ingested document with \${doc.chunkCount} chunks\`);
    console.log(\`Extracted entities: \${doc.entities?.join(", ")}\`);
    
    // Create a memory linking to this document
    const memory = await services.memory.addMemory({
      content: "Documentation about TypeScript features",
      layer: "documentary",
      importance: 0.7,
      metadata: {
        docId: doc.document.id
      }
    });
    
    return {
      documentId: doc.document.id,
      chunkCount: doc.chunkCount,
      entities: doc.entities,
      memoryId: memory.id
    };
  `
}
```

---

### Example 3: Single-Tool - Complex Workflow

```typescript
// Tool: run_code
{
  "code": `
    // Search for existing memories
    const existing = await services.memory.searchMemories({
      query: "project requirements",
      topK: 3
    });
    
    console.log(\`Found \${existing.length} existing memories\`);
    
    // Add new memory if none found
    if (existing.length === 0) {
      const newMem = await services.memory.addMemory({
        content: "Project requires TypeScript and React",
        layer: "semantic",
        importance: 0.8
      });
      console.log("Created new memory:", newMem.id);
    }
    
    // Get system status
    const status = await services.system.status();
    
    // List entities
    const entities = await services.knowledge.listEntities({ limit: 10 });
    
    return {
      existingMemoryCount: existing.length,
      systemHealth: status.vectra.ok,
      totalEntities: entities.entities.length,
      topEntities: entities.entities.slice(0, 3).map(e => e.name)
    };
  `
}
```

---

### Example 4: Multi-Tool - Add Memory

```json
{
  "tool": "memory.add",
  "input": {
    "content": "User completed onboarding tutorial",
    "layer": "episodic",
    "importance": 0.6,
    "sessionId": "session-123",
    "metadata": {
      "event": "onboarding_complete",
      "timestamp": 1699564800000
    }
  }
}
```

**Response:**
```json
{
  "memory": {
    "id": "mem-uuid",
    "layer": "episodic",
    "content": "User completed onboarding tutorial",
    "metadata": {
      "event": "onboarding_complete",
      "timestamp": 1699564800000
    },
    "createdAt": 1699564800000,
    "updatedAt": 1699564800000,
    "importance": 0.6,
    "sessionId": "session-123"
  }
}
```

---

### Example 5: Multi-Tool - Search Memories

```json
{
  "tool": "memory.search",
  "input": {
    "query": "onboarding",
    "topK": 5,
    "layers": ["episodic"],
    "sessionId": "session-123"
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "mem-uuid",
      "layer": "episodic",
      "content": "User completed onboarding tutorial",
      "score": 0.92,
      "vectorScore": 0.89,
      "textScore": 0.95,
      "importance": 0.6,
      "sessionId": "session-123",
      "createdAt": 1699564800000,
      "updatedAt": 1699564800000,
      "metadata": {
        "event": "onboarding_complete"
      }
    }
  ]
}
```

---

### Example 6: Multi-Tool - Document Store

```json
{
  "tool": "document.store",
  "input": {
    "path": "/docs/api-reference.md",
    "metadata": {
      "title": "API Reference",
      "version": "1.0"
    },
    "options": {
      "chunkSize": 800,
      "chunkOverlap": 60,
      "generateSummary": true,
      "detectEntities": true
    }
  }
}
```

**Response:**
```json
{
  "document": {
    "id": "doc-uuid",
    "hash": "sha256-hash",
    "sourcePath": "/docs/api-reference.md",
    "mime": "text/markdown",
    "title": "API Reference",
    "metadata": {
      "title": "API Reference",
      "version": "1.0"
    },
    "ingestedAt": 1699564800000,
    "sizeBytes": 15420,
    "chunks": [
      {
        "id": "chunk-1",
        "docId": "doc-uuid",
        "positionStart": 0,
        "positionEnd": 800,
        "content": "# API Reference\n\n...",
        "summary": "Introduction to API endpoints",
        "embeddingId": "chunk-1",
        "metadata": { "order": 0 }
      }
    ]
  },
  "chunkCount": 20,
  "entities": ["API", "endpoint", "authentication"]
}
```

---

### Example 7: Multi-Tool - System Status

```json
{
  "tool": "system.status",
  "input": {}
}
```

**Response:**
```json
{
  "status": {
    "env": "development",
    "logLevel": "info",
    "dataRoot": "/path/to/data",
    "vectra": {
      "ok": true,
      "memoryIndex": true,
      "documentIndex": true,
      "counts": {
        "memories": 1523,
        "docChunks": 4891
      }
    }
  }
}
```

---

## Best Practices

### For Single-Tool Mode

1. **Keep code focused**: Each `run_code` invocation should have a clear purpose
2. **Use console.log**: Log progress for debugging and transparency
3. **Handle errors**: Wrap operations in try-catch blocks
4. **Return structured data**: Return objects, not just primitives
5. **Respect timeouts**: Be mindful of execution time limits
6. **Batch operations**: Combine related operations in one call

### For Multi-Tool Mode

1. **Use appropriate tools**: Select the most specific tool for your need
2. **Validate inputs**: Ensure all required fields are provided
3. **Handle pagination**: Use limit/offset for large result sets
4. **Check responses**: Verify tool execution succeeded
5. **Chain operations**: Use tool outputs as inputs to subsequent calls

### General Guidelines

1. **Choose the right mode**: Single-tool for flexibility, multi-tool for simplicity
2. **Monitor performance**: Use `system.status` to check health
3. **Manage memory layers**: Use appropriate layers for different data types
4. **Set importance correctly**: Higher importance for critical information
5. **Use metadata**: Store additional context in metadata fields
6. **Leverage search**: Use hybrid search for best results
7. **Process documents**: Chunk and embed documents for better retrieval

---

## Troubleshooting

### Common Issues

**Issue**: `run_code` times out
- **Solution**: Reduce operation complexity or increase `timeoutMs`

**Issue**: Memory search returns no results
- **Solution**: Check layer filters, verify embeddings are generated

**Issue**: Document ingestion fails
- **Solution**: Verify file path exists, check MIME type, ensure content is text

**Issue**: Entities not extracted
- **Solution**: Enable `detectEntities: true` in document options

**Issue**: System status shows unhealthy
- **Solution**: Check data directory permissions, verify SQLite/Vectra initialization

### Debug Tips

1. Use `console.log` extensively in `run_code`
2. Check logs with `LOG_LEVEL=debug`
3. Verify configuration with `system.status`
4. Test with small datasets first
5. Monitor background job execution

---

## Conclusion

MemorizedMCP-TS provides a flexible, powerful MCP server for hybrid memory and document management. Whether you use single-tool mode for programmatic flexibility or multi-tool mode for explicit operations, the server delivers robust capabilities for building intelligent, context-aware applications.
