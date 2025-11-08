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
} from "../schemas/document";
import {
  MemoryAddInputSchema,
  MemorySearchRequestSchema,
  MemorySearchResultSchema,
  MemoryRecordSchema,
} from "../schemas/memory";
import {
  KnowledgeListEntitiesRequestSchema,
  KnowledgeEntitySchema,
} from "../schemas/knowledge";
import type { ServiceRegistry } from "../services/types";

export async function startMcpServer(container: AppContainer): Promise<void> {
  const { config, logger, services } = container;

  const server = new McpServer(
    {
      name: "memorizedmcp-ts",
      version: process.env.npm_package_version ?? "0.1.0",
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
    "  - services.memory.addMemory / searchMemories / deleteMemory",
    "  - services.document.ingest / getDocument / listDocuments",
    "  - services.knowledge.ensureEntities / listEntities",
    "  - services.search.searchMemories",
    "  - services.system.status",
    "Console output is captured and returned alongside structured results.",
    "Beware of long-running loops; snippets are terminated after the configured timeout.",
  ];

  if (multiTool) {
    base.push(
      "",
      "Multi-tool mode is enabled; direct tool calls are available (memory.add, memory.search, document.store, document.retrieve, document.list, knowledge.list_entities, system.status).",
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

