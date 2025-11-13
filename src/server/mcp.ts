import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { AppContainer } from "../container";
import { executeUserCode } from "./sandbox";
import {
  DocumentIngestionRequestSchema,
  DocumentListRequestSchema,
  DocumentRetrieveRequestSchema,
  DocumentIngestionResultSchema,
  DocumentRecordSchema,
  DocumentUpdateRequestSchema,
  DocumentDeleteRequestSchema,
  DocumentSearchRequestSchema,
  DocumentGetReferencesRequestSchema,
  DocumentAnalyzeRequestSchema,
  DocumentAnalysisSchema,
} from "../schemas/document";
import {
  MemoryAddInputSchema,
  MemorySearchRequestSchema,
  MemorySearchResultSchema,
  MemoryRecordSchema,
  MemoryGetRequestSchema,
  MemoryGetByEntityRequestSchema,
  MemoryGetByDocumentRequestSchema,
} from "../schemas/memory";
import {
  KnowledgeListEntitiesRequestSchema,
  KnowledgeEntitySchema,
  KnowledgeEntityDetailSchema,
  KnowledgeEdgeSchema,
  KnowledgeGraphSnapshotSchema,
  KnowledgeEntityContextSchema,
  KnowledgeGetEntityRequestSchema,
  KnowledgeCreateEntityRequestSchema,
  KnowledgeUpdateEntityRequestSchema,
  KnowledgeDeleteEntityRequestSchema,
  KnowledgeCreateRelationRequestSchema,
  KnowledgeGetRelationsRequestSchema,
  KnowledgeDeleteRelationRequestSchema,
  KnowledgeSearchRelationsRequestSchema,
  KnowledgeSearchEntitiesRequestSchema,
  KnowledgeGetEntitiesByTypeRequestSchema,
  KnowledgeGetEntitiesByTagRequestSchema,
  KnowledgeTagEntityRequestSchema,
  KnowledgeRemoveTagRequestSchema,
  KnowledgeGetTagsRequestSchema,
  KnowledgeReadGraphRequestSchema,
  KnowledgeGetRelatedEntitiesRequestSchema,
  KnowledgeFindPathRequestSchema,
  KnowledgeGetEntityContextRequestSchema,
  KnowledgeGetEntitiesInDocumentRequestSchema,
  KnowledgeGetEntitiesInMemoryRequestSchema,
} from "../schemas/knowledge";
import type { ServiceRegistry } from "../services/types";

export interface McpServerHandle {
  readonly server: McpServer;
  readonly transport: StdioServerTransport;
}

export async function startMcpServer(
  container: AppContainer,
): Promise<McpServerHandle> {
  const { config, logger, services } = container;

  const server = new McpServer(
    {
      name: "memorizedmcp-ts",
      version: process.env.npm_package_version ?? "1.1.5",
    },
    {
      instructions: buildInstructions(config.mcp.multiTool),
    },
  );

  registerRunCodeTool(server, services, config.mcp.singleToolTimeoutMs, logger);

  if (config.mcp.multiTool) {
    registerMultiTools(server, services, logger);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP stdio server initialized.");

  return { server, transport };
}

function registerRunCodeTool(
  server: McpServer,
  services: ServiceRegistry,
  defaultTimeout: number,
  logger: { error: (...args: unknown[]) => void },
) {
  server.registerTool(
    "run_code",
    {
      title: "Execute TypeScript in MemorizedMCP sandbox",
      description:
        "Runs a TypeScript snippet with access to typed service bindings. Return values are captured as structured results, and console output is streamed back.",
      inputSchema: {
        code: z.string().min(1, "Provide TypeScript source to execute."),
        timeoutMs: z.number().int().min(100).max(600_000).optional(),
      },
      outputSchema: {
        result: z.unknown().optional(),
        logs: z.array(z.string()),
      },
    },
    async ({ code, timeoutMs }) => {
      try {
        const execution = await executeUserCode(code, services, {
          timeoutMs: timeoutMs ?? defaultTimeout,
        });

        const structured = {
          result: execution.result,
          logs: execution.logs,
        };

        return {
          content: [
            {
              type: "text",
              text: formatStructured(structured),
            },
          ],
          structuredContent: structured,
        };
      } catch (error) {
        logger.error("run_code execution failed", error);
        throw error;
      }
    },
  );
}

function registerMultiTools(
  server: McpServer,
  services: ServiceRegistry,
  logger: { error: (...args: unknown[]) => void },
) {
  server.registerTool(
    "memory.add",
    {
      title: "Add a memory entry",
      description:
        "Stores a memory within the requested layer, computes embeddings, and returns the stored record.",
      inputSchema: MemoryAddInputSchema.shape,
      outputSchema: {
        memory: MemoryRecordSchema,
      },
    },
    async (args) => {
      const record = await services.memory.addMemory(args);
      const structured = { memory: record };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "memory.search",
    {
      title: "Search memories",
      description:
        "Performs hybrid search (vector + FTS) across the memory index and returns ranked matches.",
      inputSchema: MemorySearchRequestSchema.shape,
      outputSchema: {
        results: z.array(MemorySearchResultSchema),
      },
    },
    async (args) => {
      const results = await services.memory.searchMemories(args);
      const structured = { results };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "memory.get",
    {
      title: "Get memory by ID",
      description: "Retrieve a single memory by its ID",
      inputSchema: MemoryGetRequestSchema.shape,
      outputSchema: {
        memory: MemoryRecordSchema.optional(),
      },
    },
    async (args) => {
      const memory = await services.memory.getMemory(args);
      const structured = { memory };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "memory.get_by_entity",
    {
      title: "Get memories by entity",
      description: "Get all memories mentioning a specific entity",
      inputSchema: MemoryGetByEntityRequestSchema.shape,
      outputSchema: {
        memories: z.array(MemoryRecordSchema),
      },
    },
    async (args) => {
      const memories = await services.memory.getMemoriesByEntity(args);
      const structured = { memories };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "memory.get_by_document",
    {
      title: "Get memories by document",
      description: "Get all memories referencing a specific document",
      inputSchema: MemoryGetByDocumentRequestSchema.shape,
      outputSchema: {
        memories: z.array(MemoryRecordSchema),
      },
    },
    async (args) => {
      const memories = await services.memory.getMemoriesByDocument(args);
      const structured = { memories };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.store",
    {
      title: "Ingest a document",
      description:
        "Stores document content, chunking, embeddings, and knowledge graph entities for future retrieval.",
      inputSchema: DocumentIngestionRequestSchema.shape,
      outputSchema: {
        document: DocumentRecordSchema,
        chunkCount: z.number().int().min(0),
        entities: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const result = await services.document.ingest(args);
      const structured = { 
        document: result.document, 
        chunkCount: result.chunkCount, 
        entities: result.entities 
      };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.retrieve",
    {
      title: "Retrieve a document by ID",
      inputSchema: DocumentRetrieveRequestSchema.shape,
      outputSchema: {
        document: DocumentRecordSchema,
      },
    },
    async ({ id }) => {
      const document = await services.document.getDocument(id);
      if (!document) {
        throw new Error(`Document ${id} not found`);
      }
      const structured = { document };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.list",
    {
      title: "List recently ingested documents",
      inputSchema: DocumentListRequestSchema.shape,
      outputSchema: {
        documents: z.array(DocumentRecordSchema),
      },
    },
    async (args) => {
      const { limit, offset } = args;
      const docs = await services.document.listDocuments(limit, offset);
      const structured = { documents: docs };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.update",
    {
      title: "Update document",
      description: "Update document metadata or title",
      inputSchema: DocumentUpdateRequestSchema.shape,
      outputSchema: {
        document: DocumentRecordSchema,
      },
    },
    async (args) => {
      const document = await services.document.updateDocument(args);
      const structured = { document };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.delete",
    {
      title: "Delete document",
      description: "Delete a document and its chunks",
      inputSchema: DocumentDeleteRequestSchema.shape,
      outputSchema: {
        success: z.boolean(),
      },
    },
    async (args) => {
      await services.document.deleteDocument(args);
      const structured = { success: true };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.search",
    {
      title: "Search documents",
      description: "Search documents by content using FTS5",
      inputSchema: DocumentSearchRequestSchema.shape,
      outputSchema: {
        documents: z.array(DocumentRecordSchema),
      },
    },
    async (args) => {
      const documents = await services.document.searchDocuments(args);
      const structured = { documents };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.get_references",
    {
      title: "Get document references",
      description: "Get all memories referencing a document",
      inputSchema: DocumentGetReferencesRequestSchema.shape,
      outputSchema: {
        memories: z.array(z.any()),
      },
    },
    async (args) => {
      const memories = await services.document.getDocumentReferences(args);
      const structured = { memories };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "document.analyze",
    {
      title: "Analyze document",
      description: "Get document analysis including entities, chunks, and stats",
      inputSchema: DocumentAnalyzeRequestSchema.shape,
      outputSchema: {
        analysis: DocumentAnalysisSchema,
      },
    },
    async (args) => {
      const analysis = await services.document.analyzeDocument(args);
      const structured = { analysis };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.list_entities",
    {
      title: "List knowledge graph entities",
      inputSchema: KnowledgeListEntitiesRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const { limit, offset } = args;
      const entities = await services.knowledge.listEntities(limit, offset);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_entity",
    {
      title: "Get entity by ID or name",
      description: "Retrieves an entity by ID or name with relation count",
      inputSchema: KnowledgeGetEntityRequestSchema.shape,
      outputSchema: {
        entity: KnowledgeEntityDetailSchema.optional(),
      },
    },
    async (args) => {
      const entity = await services.knowledge.getEntity(args);
      const structured = { entity };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.create_entity",
    {
      title: "Create a new entity",
      description: "Manually create a new knowledge graph entity",
      inputSchema: KnowledgeCreateEntityRequestSchema.shape,
      outputSchema: {
        entity: KnowledgeEntitySchema,
      },
    },
    async (args) => {
      const entity = await services.knowledge.createEntity(args);
      const structured = { entity };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.update_entity",
    {
      title: "Update an entity",
      description: "Update entity name, type, or tags",
      inputSchema: KnowledgeUpdateEntityRequestSchema.shape,
      outputSchema: {
        entity: KnowledgeEntitySchema,
      },
    },
    async (args) => {
      const entity = await services.knowledge.updateEntity(args);
      const structured = { entity };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.delete_entity",
    {
      title: "Delete an entity",
      description: "Delete an entity and cascade delete its relationships",
      inputSchema: KnowledgeDeleteEntityRequestSchema.shape,
      outputSchema: {
        success: z.boolean(),
      },
    },
    async (args) => {
      await services.knowledge.deleteEntity(args);
      const structured = { success: true };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.create_relation",
    {
      title: "Create a relationship",
      description: "Create a relationship between two entities",
      inputSchema: KnowledgeCreateRelationRequestSchema.shape,
      outputSchema: {
        relation: KnowledgeEdgeSchema,
      },
    },
    async (args) => {
      const relation = await services.knowledge.createRelation(args);
      const structured = { relation };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_relations",
    {
      title: "Get entity relations",
      description: "Get all relationships for an entity, optionally filtered by relation type",
      inputSchema: KnowledgeGetRelationsRequestSchema.shape,
      outputSchema: {
        relations: z.array(KnowledgeEdgeSchema),
      },
    },
    async (args) => {
      const relations = await services.knowledge.getEntityRelations(args);
      const structured = { relations };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.delete_relation",
    {
      title: "Delete a relationship",
      description: "Delete a specific relationship by ID",
      inputSchema: KnowledgeDeleteRelationRequestSchema.shape,
      outputSchema: {
        success: z.boolean(),
      },
    },
    async (args) => {
      await services.knowledge.deleteRelation(args);
      const structured = { success: true };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.search_relations",
    {
      title: "Search relationships",
      description: "Search relationships by relation type",
      inputSchema: KnowledgeSearchRelationsRequestSchema.shape,
      outputSchema: {
        relations: z.array(KnowledgeEdgeSchema),
      },
    },
    async (args) => {
      const relations = await services.knowledge.searchRelations(args);
      const structured = { relations };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.search_entities",
    {
      title: "Search entities",
      description: "Search entities by name (FTS), type, or tags",
      inputSchema: KnowledgeSearchEntitiesRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const entities = await services.knowledge.searchEntities(args);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_entities_by_type",
    {
      title: "Get entities by type",
      description: "Get all entities of a specific type",
      inputSchema: KnowledgeGetEntitiesByTypeRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const entities = await services.knowledge.getEntitiesByType(args);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_entities_by_tag",
    {
      title: "Get entities by tag",
      description: "Get all entities with a specific tag",
      inputSchema: KnowledgeGetEntitiesByTagRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const entities = await services.knowledge.getEntitiesByTag(args);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.tag_entity",
    {
      title: "Tag an entity",
      description: "Add tags to an entity (merges with existing tags)",
      inputSchema: KnowledgeTagEntityRequestSchema.shape,
      outputSchema: {
        entity: KnowledgeEntitySchema,
      },
    },
    async (args) => {
      const entity = await services.knowledge.tagEntity(args);
      const structured = { entity };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.remove_tag",
    {
      title: "Remove tag from entity",
      description: "Remove a specific tag from an entity",
      inputSchema: KnowledgeRemoveTagRequestSchema.shape,
      outputSchema: {
        entity: KnowledgeEntitySchema,
      },
    },
    async (args) => {
      const entity = await services.knowledge.removeTag(args);
      const structured = { entity };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_tags",
    {
      title: "Get all tags",
      description: "List all unique tags from entities",
      inputSchema: KnowledgeGetTagsRequestSchema.shape,
      outputSchema: {
        tags: z.array(z.string()),
      },
    },
    async () => {
      const tags = await services.knowledge.getTags({});
      const structured = { tags };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.read_graph",
    {
      title: "Read graph neighborhood",
      description: "Get graph neighborhood around an entity up to specified depth",
      inputSchema: KnowledgeReadGraphRequestSchema.shape,
      outputSchema: {
        graph: KnowledgeGraphSnapshotSchema,
      },
    },
    async (args) => {
      const graph = await services.knowledge.readGraph(args);
      const structured = { graph };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_related_entities",
    {
      title: "Get related entities",
      description: "Get all entities directly related to an entity (1-hop neighbors)",
      inputSchema: KnowledgeGetRelatedEntitiesRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const entities = await services.knowledge.getRelatedEntities(args);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.find_path",
    {
      title: "Find path between entities",
      description: "Find shortest path between two entities using BFS",
      inputSchema: KnowledgeFindPathRequestSchema.shape,
      outputSchema: {
        path: z.array(KnowledgeEdgeSchema),
      },
    },
    async (args) => {
      const path = await services.knowledge.findPath(args);
      const structured = { path };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_entity_context",
    {
      title: "Get entity context",
      description: "Get all documents, memories, and chunks mentioning an entity",
      inputSchema: KnowledgeGetEntityContextRequestSchema.shape,
      outputSchema: {
        context: KnowledgeEntityContextSchema,
      },
    },
    async (args) => {
      const context = await services.knowledge.getEntityContext(args);
      const structured = { context };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_entities_in_document",
    {
      title: "Get entities in document",
      description: "Extract and return all entities mentioned in a document",
      inputSchema: KnowledgeGetEntitiesInDocumentRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const entities = await services.knowledge.getEntitiesInDocument(args);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "knowledge.get_entities_in_memory",
    {
      title: "Get entities in memory",
      description: "Extract and return all entities mentioned in a memory",
      inputSchema: KnowledgeGetEntitiesInMemoryRequestSchema.shape,
      outputSchema: {
        entities: z.array(KnowledgeEntitySchema),
      },
    },
    async (args) => {
      const entities = await services.knowledge.getEntitiesInMemory(args);
      const structured = { entities };
      return {
        content: [{ type: "text", text: formatStructured(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    "system.status",
    {
      title: "Report MemorizedMCP system status",
      outputSchema: {
        status: z.object({
          vectraHealth: z.boolean(),
          lastConsolidation: z.number().nullable(),
          lastBackup: z.number().nullable(),
        }),
      },
    },
    async () => {
      try {
        const status = await services.system.status();
        const structured = { status };
        return {
          content: [{ type: "text", text: formatStructured(structured) }],
          structuredContent: structured,
        };
      } catch (error) {
        logger.error("system.status failed", error);
        throw error;
      }
    },
  );
}

function buildInstructions(multiTool: boolean): string {
  const base = [
    "MemorizedMCP-TS exposes hybrid memory, document, and knowledge graph operations.",
    "Single-tool mode: call `run_code` with a TypeScript snippet.",
    "Available bindings in the sandbox:",
    "  - services.memory.addMemory / searchMemories / updateMemory / deleteMemory / getMemory / getMemoriesByEntity / getMemoriesByDocument",
    "  - services.document.ingest / getDocument / listDocuments / updateDocument / deleteDocument / searchDocuments / getDocumentReferences / analyzeDocument",
    "  - services.knowledge.ensureEntities / listEntities / getEntity / createEntity / updateEntity / deleteEntity / createRelation / getEntityRelations / deleteRelation / searchRelations / searchEntities / getEntitiesByType / getEntitiesByTag / tagEntity / removeTag / getTags / readGraph / getRelatedEntities / findPath / getEntityContext / getEntitiesInDocument / getEntitiesInMemory",
    "  - services.search.searchMemories",
    "  - services.system.status",
    "Console output is captured and returned alongside structured results.",
    "Beware of long-running loops; snippets are terminated after the configured timeout.",
  ];

  if (multiTool) {
    base.push(
      "",
      "Multi-tool mode is enabled; direct tool calls are available (memory.add, memory.search, memory.get, memory.get_by_entity, memory.get_by_document, document.store, document.retrieve, document.list, document.update, document.delete, document.search, document.get_references, document.analyze, knowledge.list_entities, knowledge.get_entity, knowledge.create_entity, knowledge.update_entity, knowledge.delete_entity, knowledge.create_relation, knowledge.get_relations, knowledge.delete_relation, knowledge.search_relations, knowledge.search_entities, knowledge.get_entities_by_type, knowledge.get_entities_by_tag, knowledge.tag_entity, knowledge.remove_tag, knowledge.get_tags, knowledge.read_graph, knowledge.get_related_entities, knowledge.find_path, knowledge.get_entity_context, knowledge.get_entities_in_document, knowledge.get_entities_in_memory, system.status).",
    );
  }

  return base.join("\n");
}

function formatStructured(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

