import path from "node:path";
import { writeFile } from "node:fs/promises";
import { ensureDir } from "fs-extra";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadConfig } from "../config";
import { createLogger } from "../logging";
import {
  MemoryAddInputSchema,
  MemoryRecordSchema,
  MemorySearchRequestSchema,
  MemorySearchResultSchema,
} from "../schemas/memory";
import {
  DocumentIngestionRequestSchema,
  DocumentIngestionResultSchema,
  DocumentRecordSchema,
} from "../schemas/document";
import {
  KnowledgeEntitySchema,
  KnowledgeEdgeSchema,
} from "../schemas/knowledge";
import { HybridSearchResultSchema } from "../schemas/search";
import { MemoryMetricSchema } from "../schemas/analytics";

interface SchemaEntry {
  filename: string;
  schema: Parameters<typeof zodToJsonSchema>[0];
  id: string;
}

const SCHEMA_ENTRIES: SchemaEntry[] = [
  {
    filename: "memory-add-input",
    schema: MemoryAddInputSchema,
    id: "MemoryAddInput",
  },
  {
    filename: "memory-record",
    schema: MemoryRecordSchema,
    id: "MemoryRecord",
  },
  {
    filename: "memory-search-request",
    schema: MemorySearchRequestSchema,
    id: "MemorySearchRequest",
  },
  {
    filename: "memory-search-result",
    schema: MemorySearchResultSchema,
    id: "MemorySearchResult",
  },
  {
    filename: "document-ingestion-request",
    schema: DocumentIngestionRequestSchema,
    id: "DocumentIngestionRequest",
  },
  {
    filename: "document-ingestion-result",
    schema: DocumentIngestionResultSchema,
    id: "DocumentIngestionResult",
  },
  {
    filename: "document-record",
    schema: DocumentRecordSchema,
    id: "DocumentRecord",
  },
  {
    filename: "knowledge-entity",
    schema: KnowledgeEntitySchema,
    id: "KnowledgeEntity",
  },
  {
    filename: "knowledge-edge",
    schema: KnowledgeEdgeSchema,
    id: "KnowledgeEdge",
  },
  {
    filename: "hybrid-search-result",
    schema: HybridSearchResultSchema,
    id: "HybridSearchResult",
  },
  {
    filename: "memory-metric",
    schema: MemoryMetricSchema,
    id: "MemoryMetric",
  },
];

export async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const outputDir = path.resolve(process.cwd(), "generated", "schemas");

  await ensureDir(outputDir);
  logger.info({ outputDir }, "Generating JSON schemas from Zod definitions.");

  for (const entry of SCHEMA_ENTRIES) {
    const jsonSchema = zodToJsonSchema(entry.schema, entry.id, {
      target: "jsonSchema7",
      $refStrategy: "none",
    });
    const filepath = path.join(outputDir, `${entry.filename}.json`);
    await writeFile(filepath, JSON.stringify(jsonSchema, null, 2), "utf8");
    logger.info({ schema: entry.id, filepath }, "Schema written.");
  }

  logger.info({ count: SCHEMA_ENTRIES.length }, "Schema generation completed.");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Schema generation script failed:", error);
    process.exit(1);
  });
}
