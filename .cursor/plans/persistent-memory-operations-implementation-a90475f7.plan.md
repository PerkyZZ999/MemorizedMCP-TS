<!-- a90475f7-0136-485a-9daa-df252e1a6a9d 85ce58ca-0954-4594-a4cb-34cca39ba0f2 -->
# Implementation Plan: Persistent Memory Operations

## Overview

Implement all missing operations identified in the Persistent-Memory-Assessment.md file. The infrastructure (database tables, repository methods) mostly exists, so the focus is on exposing these capabilities through the service layer, schemas, and MCP tools.

## Implementation Strategy

1. **Phase 1**: Core Knowledge Graph Operations (Priority 1)
2. **Phase 2**: Memory & Document Enhancements (Priority 2)
3. **Phase 3**: Advanced Features (Priority 3)

Each phase builds on the previous one, with clear dependencies.

---

## Phase 1: Core Knowledge Graph Operations

### 1.1 Entity Management

#### Files to Modify:

- `src/schemas/knowledge.ts` - Add new schemas
- `src/services/knowledge-graph-service.ts` - Add service methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools (multi-tool mode)
- `src/repositories/knowledge-graph-repository.ts` - May need helper methods

#### Tasks:

1. **Add Schemas** (`src/schemas/knowledge.ts`):

- `KnowledgeGetEntityRequestSchema` - { id?: string, name?: string }
- `KnowledgeCreateEntityRequestSchema` - { name, type, tags?, metadata? }
- `KnowledgeUpdateEntityRequestSchema` - Partial update
- `KnowledgeDeleteEntityRequestSchema` - { id: string }
- `KnowledgeEntityDetailSchema` - Entity with relations count

2. **Add Service Methods** (`src/services/knowledge-graph-service.ts`):

- `getEntity(idOrName: string)` - Get by ID or name, include relation counts
- `createEntity(input)` - Manually create entity, validate type
- `updateEntity(id, patch)` - Update name, type, tags, metadata
- `deleteEntity(id)` - Delete entity and cascade to edges

3. **Update Service Interface** (`src/services/types.ts`):

- Extend `KnowledgeGraphService` interface with new methods

4. **Register MCP Tools** (`src/server/mcp.ts`):

- `knowledge.get_entity` - Get entity details
- `knowledge.create_entity` - Create entity
- `knowledge.update_entity` - Update entity
- `knowledge.delete_entity` - Delete entity

5. **Repository Enhancements** (if needed):

- Add method to get entity with relation counts
- Add method to search entities by name/type/tags

### 1.2 Relationship Management

#### Files to Modify:

- `src/schemas/knowledge.ts` - Add relation schemas
- `src/services/knowledge-graph-service.ts` - Add relation methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools
- `src/repositories/knowledge-graph-repository.ts` - Add search methods

#### Tasks:

1. **Add Schemas** (`src/schemas/knowledge.ts`):

- `KnowledgeCreateRelationRequestSchema` - { src, dst, relation, weight?, metadata? }
- `KnowledgeGetRelationsRequestSchema` - { entityId: string, relationType?: string }
- `KnowledgeDeleteRelationRequestSchema` - { id: string }
- `KnowledgeSearchRelationsRequestSchema` - { query, relationType?, limit?, offset? }

2. **Add Service Methods** (`src/services/knowledge-graph-service.ts`):

- `createRelation(input)` - Create edge, validate entities exist
- `getEntityRelations(entityId, relationType?)` - Get all relations for entity
- `deleteRelation(relationId)` - Delete specific relation
- `searchRelations(query)` - Search relations by type, entity

3. **Update Service Interface** (`src/services/types.ts`):

- Add relation methods to `KnowledgeGraphService`

4. **Register MCP Tools** (`src/server/mcp.ts`):

- `knowledge.create_relation` - Create relationship
- `knowledge.get_relations` - Get entity relations
- `knowledge.delete_relation` - Delete relation
- `knowledge.search_relations` - Search relations

5. **Repository Enhancements**:

- Add `searchEdgesByRelation(relationType)` method
- Add `getEdgesByEntityAndType(entityId, relationType?)` method

### 1.3 Graph Traversal

#### Files to Modify:

- `src/schemas/knowledge.ts` - Add graph schemas
- `src/services/knowledge-graph-service.ts` - Add traversal methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools

#### Tasks:

1. **Add Schemas** (`src/schemas/knowledge.ts`):

- `KnowledgeReadGraphRequestSchema` - { entityId: string, depth?: number, relationType?: string }
- `KnowledgeGraphSnapshotSchema` - { entity, relations: [], neighbors: [] }
- `KnowledgeGetRelatedEntitiesRequestSchema` - { entityId: string, relationType?: string, limit?: number }
- `KnowledgeFindPathRequestSchema` - { src: string, dst: string, maxDepth?: number }

2. **Add Service Methods** (`src/services/knowledge-graph-service.ts`):

- `readGraph(entityId, depth?, relationType?)` - BFS traversal, return neighborhood
- `getRelatedEntities(entityId, relationType?, limit?)` - Get 1-hop neighbors
- `findPath(src, dst, maxDepth?)` - Shortest path using BFS

3. **Update Service Interface** (`src/services/types.ts`):

- Add traversal methods

4. **Register MCP Tools** (`src/server/mcp.ts`):

- `knowledge.read_graph` - Get graph neighborhood
- `knowledge.get_related_entities` - Get related entities
- `knowledge.find_path` - Find path between entities

### 1.4 Entity Context

#### Files to Modify:

- `src/schemas/knowledge.ts` - Add context schemas
- `src/services/knowledge-graph-service.ts` - Add context methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools
- `src/repositories/knowledge-graph-repository.ts` - May need new methods
- Consider: Create `entity_mentions` junction table for performance

#### Tasks:

1. **Database Schema Consideration**:

- Option A: Use FTS/search to find entity mentions (slower, no schema change)
- Option B: Create `entity_mentions` table (faster, requires migration)
- Recommendation: Start with Option A, add Option B as optimization

2. **Add Schemas** (`src/schemas/knowledge.ts`):

- `KnowledgeGetEntityContextRequestSchema` - { entityId: string }
- `KnowledgeEntityContextSchema` - { documents: [], memories: [], chunks: [] }
- `KnowledgeGetEntitiesInDocumentRequestSchema` - { docId: string }
- `KnowledgeGetEntitiesInMemoryRequestSchema` - { memoryId: string }

3. **Add Service Methods** (`src/services/knowledge-graph-service.ts`):

- `getEntityContext(entityId)` - Search docs/memories for entity name
- `getEntitiesInDocument(docId)` - Get entities extracted from document
- `getEntitiesInMemory(memoryId)` - Extract entities from memory content

4. **Repository Enhancements**:

- Add FTS search for entity names in document chunks
- Add FTS search for entity names in memories
- Link entity extraction results to documents during ingestion

5. **Update Service Interface** (`src/services/types.ts`):

- Add context methods

6. **Register MCP Tools** (`src/server/mcp.ts`):

- `knowledge.get_entity_context` - Get entity context
- `knowledge.get_entities_in_document` - Get document entities
- `knowledge.get_entities_in_memory` - Get memory entities

### 1.5 Entity Search

#### Files to Modify:

- `src/schemas/knowledge.ts` - Add search schemas
- `src/services/knowledge-graph-service.ts` - Add search methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools
- `src/repositories/knowledge-graph-repository.ts` - Add search methods

#### Tasks:

1. **Add Schemas** (`src/schemas/knowledge.ts`):

- `KnowledgeSearchEntitiesRequestSchema` - { name?: string, type?: string, tags?: string[], limit?, offset? }
- `KnowledgeGetEntitiesByTypeRequestSchema` - { type: string, limit?, offset? }
- `KnowledgeGetEntitiesByTagRequestSchema` - { tag: string, limit?, offset? }

2. **Add Service Methods** (`src/services/knowledge-graph-service.ts`):

- `searchEntities(query)` - Search by name (FTS), type, tags
- `getEntitiesByType(type, limit?, offset?)` - Filter by type
- `getEntitiesByTag(tag, limit?, offset?)` - Filter by tag

3. **Repository Enhancements**:

- Add `searchEntitiesByName(name)` using FTS5
- Add `findEntitiesByType(type, limit, offset)`
- Add `findEntitiesByTag(tag, limit, offset)`

4. **Update Service Interface** (`src/services/types.ts`):

- Add search methods

5. **Register MCP Tools** (`src/server/mcp.ts`):

- `knowledge.search_entities` - Search entities
- `knowledge.get_entities_by_type` - Get by type
- `knowledge.get_entities_by_tag` - Get by tag

### 1.6 Entity Tagging

#### Files to Modify:

- `src/schemas/knowledge.ts` - Add tag schemas
- `src/services/knowledge-graph-service.ts` - Add tagging methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools
- `src/repositories/knowledge-graph-repository.ts` - Use existing setEntityTags

#### Tasks:

1. **Add Schemas** (`src/schemas/knowledge.ts`):

- `KnowledgeTagEntityRequestSchema` - { entityId: string, tags: string[] }
- `KnowledgeRemoveTagRequestSchema` - { entityId: string, tag: string }
- `KnowledgeGetTagsRequestSchema` - {} (no input)

2. **Add Service Methods** (`src/services/knowledge-graph-service.ts`):

- `tagEntity(entityId, tags)` - Add tags (merge with existing)
- `removeTag(entityId, tag)` - Remove specific tag
- `getTags()` - List all tags from tags table

3. **Repository Enhancements**:

- Ensure `setEntityTags` handles tag merging
- Add `getAllTags()` method to query tags table

4. **Update Service Interface** (`src/services/types.ts`):

- Add tagging methods

5. **Register MCP Tools** (`src/server/mcp.ts`):

- `knowledge.tag_entity` - Add tags
- `knowledge.remove_tag` - Remove tag
- `knowledge.get_tags` - List tags

---

## Phase 2: Memory & Document Enhancements

### 2.1 Memory Operations

#### Files to Modify:

- `src/schemas/memory.ts` - Add new schemas
- `src/services/memory-service.ts` - Verify methods exist, expose via MCP
- `src/services/types.ts` - Verify interface
- `src/server/mcp.ts` - Register MCP tools
- `src/repositories/memory-repository.ts` - May need new methods

#### Tasks:

1. **Add Schemas** (`src/schemas/memory.ts`):

- `MemoryGetRequestSchema` - { id: string }
- `MemoryUpdateRequestSchema` - { id: string, patch: Partial<MemoryRecordDTO> }
- `MemoryDeleteRequestSchema` - { id: string }
- `MemoryGetByEntityRequestSchema` - { entityId: string, limit?, offset? }
- `MemoryGetByDocumentRequestSchema` - { docId: string, limit?, offset? }

2. **Verify/Add Service Methods** (`src/services/memory-service.ts`):

- `getMemory(id)` - Get single memory by ID (new method)
- `updateMemory(id, patch)` - Already exists, verify working
- `deleteMemory(id)` - Already exists, verify working
- `getMemoriesByEntity(entityId)` - Search memories mentioning entity
- `getMemoriesByDocument(docId)` - Get memories referencing document

3. **Repository Enhancements**:

- Add `findMemoriesByDocument(docId)` - Query memory_refs
- Add FTS search for entity names in memories

4. **Update Service Interface** (`src/services/types.ts`):

- Add new methods to `MemoryService`

5. **Register MCP Tools** (`src/server/mcp.ts`):

- `memory.get` - Get memory by ID
- `memory.update` - Update memory
- `memory.delete` - Delete memory
- `memory.get_by_entity` - Get memories by entity
- `memory.get_by_document` - Get memories by document

### 2.2 Document Operations

#### Files to Modify:

- `src/schemas/document.ts` - Add new schemas
- `src/services/document-service.ts` - Add new methods
- `src/services/types.ts` - Update interface
- `src/server/mcp.ts` - Register MCP tools
- `src/repositories/document-repository.ts` - May need new methods

#### Tasks:

1. **Add Schemas** (`src/schemas/document.ts`):

- `DocumentUpdateRequestSchema` - { id: string, patch: Partial<DocumentRecordDTO> }
- `DocumentDeleteRequestSchema` - { id: string }
- `DocumentSearchRequestSchema` - { query: string, limit?, offset? }
- `DocumentGetReferencesRequestSchema` - { docId: string }
- `DocumentAnalyzeRequestSchema` - { docId: string }

2. **Add Service Methods** (`src/services/document-service.ts`):

- `updateDocument(id, patch)` - Update document metadata
- `deleteDocument(id)` - Delete document and chunks, cascade to memory_refs
- `searchDocuments(query, limit?, offset?)` - FTS search document chunks
- `getDocumentReferences(docId)` - Get memories referencing document
- `analyzeDocument(docId)` - Return document analysis (entities, summary, stats)

3. **Repository Enhancements**:

- Add `deleteDocument(id)` - Cascade delete chunks
- Add FTS search for document content
- Add `findMemoriesByDocument(docId)` - Query memory_refs

4. **Update Service Interface** (`src/services/types.ts`):

- Add new methods to `DocumentService`

5. **Register MCP Tools** (`src/server/mcp.ts`):

- `document.update` - Update document
- `document.delete` - Delete document
- `document.search` - Search documents
- `document.get_references` - Get document references
- `document.analyze` - Analyze document

---

## Phase 3: Advanced Features (Future)

### 3.1 Graph Analytics

- Entity centrality calculation
- Relationship strength analysis
- Community detection
- Entity similarity

### 3.2 Memory Analytics

- Memory consolidation pipeline
- Pattern mining
- Effectiveness scoring
- Trends analysis

### 3.3 System Operations

- Backup/restore
- Data export/import
- Cleanup operations
- Reindexing

---

## Implementation Order

### Sprint 1: Entity Management (1.1)

1. Add schemas for entity CRUD
2. Implement service methods
3. Update service interface
4. Register MCP tools
5. Test with run_code

### Sprint 2: Relationship Management (1.2)

1. Add schemas for relations
2. Implement service methods
3. Update service interface
4. Register MCP tools
5. Test relations CRUD

### Sprint 3: Entity Search & Tagging (1.5, 1.6)

1. Add search schemas
2. Implement search methods
3. Implement tagging methods
4. Register MCP tools
5. Test search and tagging

### Sprint 4: Graph Traversal (1.3)

1. Add graph schemas
2. Implement traversal methods
3. Register MCP tools
4. Test graph operations

### Sprint 5: Entity Context (1.4)

1. Add context schemas
2. Implement context methods
3. Add FTS search for entity mentions
4. Register MCP tools
5. Test context retrieval

### Sprint 6: Memory Enhancements (2.1)

1. Add memory schemas
2. Implement/getMemory method
3. Verify updateMemory/deleteMemory
4. Add getMemoriesByEntity/Document
5. Register MCP tools
6. Test memory operations

### Sprint 7: Document Enhancements (2.2)

1. Add document schemas
2. Implement new document methods
3. Register MCP tools
4. Test document operations

---

## Testing Strategy

1. **Unit Tests**: Test each service method independently
2. **Integration Tests**: Test service + repository layer
3. **MCP Tests**: Test via run_code sandbox
4. **Multi-tool Tests**: Test discrete MCP tools (if multi-tool enabled)
5. **End-to-end Tests**: Test complete workflows

## Notes

- All repository methods already exist for basic operations
- Focus on service layer and MCP tool registration
- Use existing patterns from memory.add, document.store
- Follow Zod schema validation pattern
- Update buildInstructions() in mcp.ts for new tools
- Consider performance: entity context may need caching
- Entity-mention linking: Start with FTS search, optimize later with junction table

### To-dos

- [ ] Implement entity management operations (getEntity, createEntity, updateEntity, deleteEntity) with schemas, service methods, and MCP tools
- [ ] Implement relationship management operations (createRelation, getEntityRelations, deleteRelation, searchRelations) with schemas, service methods, and MCP tools
- [ ] Implement entity search operations (searchEntities, getEntitiesByType, getEntitiesByTag) with FTS5 support and MCP tools
- [ ] Implement entity tagging operations (tagEntity, removeTag, getTags) with schemas, service methods, and MCP tools
- [ ] Implement graph traversal operations (readGraph, getRelatedEntities, findPath) with BFS algorithms and MCP tools
- [ ] Implement entity context operations (getEntityContext, getEntitiesInDocument, getEntitiesInMemory) with FTS search and MCP tools
- [ ] Implement memory enhancements (getMemory, verify updateMemory/deleteMemory, getMemoriesByEntity, getMemoriesByDocument) with schemas and MCP tools
- [ ] Implement document enhancements (updateDocument, deleteDocument, searchDocuments, getDocumentReferences, analyzeDocument) with schemas and MCP tools