import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestSQLite, closeTestSQLite } from "./helpers/database";
import { DocumentRepository } from "../src/repositories/document-repository";
import { DocumentChunkRepository } from "../src/repositories/document-chunk-repository";
import { KnowledgeGraphRepository } from "../src/repositories/knowledge-graph-repository";
import { MemoryRepository } from "../src/repositories/memory-repository";
import { AnalyticsRepository } from "../src/repositories/analytics-repository";
import { JobRepository } from "../src/repositories/job-repository";
import { DefaultDocumentService, SlidingWindowTextSplitter } from "../src/services/document-service";
import { DefaultSearchService } from "../src/services/search-service";
import { DefaultMemoryService } from "../src/services/memory-service";
import { DefaultAnalyticsService } from "../src/services/analytics-service";
import { DefaultSystemService } from "../src/services/system-service";
import type { EmbeddingProvider, EntityExtractor, TextSplitterChunk } from "../src/services/types";
import { VectraAdapter } from "../src/vector/vectra";
import type { SQLiteClient } from "../src/database/sqlite";
import type { ExtractedEntity } from "../src/schemas/knowledge";
import { loadConfig } from "../src/config";

class FakeEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text, index) => {
      const base = (text.length % 7) + 1 + index * 0.1;
      return [base, base / 2, base / 3];
    });
  }
}

class StubEntityExtractor implements EntityExtractor {
  constructor(private readonly entity: ExtractedEntity = { name: "Memorized MCP", type: "project", confidence: 0.9 }) {}
  async extract(): Promise<ExtractedEntity[]> {
    return [this.entity];
  }
}

describe("Service layer integration", () => {
  let db: SQLiteClient;
  let tempDir: string;
  let vectra: VectraAdapter;
  let embeddingProvider: EmbeddingProvider;
  let textSplitter: SlidingWindowTextSplitter;

  beforeEach(async () => {
    db = await createTestSQLite();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "vectra-"));
    vectra = new VectraAdapter({
      dataRoot: tempDir,
    });
    embeddingProvider = new FakeEmbeddingProvider();
    textSplitter = new SlidingWindowTextSplitter();
  });

  afterEach(async () => {
    closeTestSQLite(db);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("ingests documents and records metadata", async () => {
    const documentRepository = new DocumentRepository(db);
    const chunkRepository = new DocumentChunkRepository(db);
    const memoryRepository = new MemoryRepository(db);
    const knowledgeRepository = new KnowledgeGraphRepository(db);

    const documentService = new DefaultDocumentService({
      documentRepository,
      chunkRepository,
      knowledgeRepository,
      vectra,
      embeddings: embeddingProvider,
      textSplitter,
      summaryGenerator: {
        summarize: async (text: string) => text.slice(0, 10),
      },
      entityExtractor: new StubEntityExtractor(),
    });

    const result = await documentService.ingest({
      content: "Memorized MCP stores memories and documents safely.",
      metadata: { title: "Spec Note" },
      options: {
        chunkSize: 160,
        chunkOverlap: 20,
        generateSummary: true,
        detectEntities: true,
      },
    });

    expect(result.chunkCount).toBeGreaterThan(0);
    expect(result.document.hash).toHaveLength(64);
    expect(result.entities).toContain("Memorized MCP");

    const stats = await vectra.stats();
    expect(stats.docChunks).toBe(result.chunkCount);
  });

  it("adds memories and performs hybrid search", async () => {
    const memoryRepository = new MemoryRepository(db);
    const searchService = new DefaultSearchService({
      memoryRepository,
      sqlite: db,
      vectra,
    });
    const memoryService = new DefaultMemoryService({
      memoryRepository,
      vectra,
      embeddings: embeddingProvider,
      searchService,
    });

    await memoryService.addMemory({
      content: "The quick brown fox jumps over the lazy dog",
      layer: "stm",
      metadata: { topic: "pangram" },
    });

    const results = await memoryService.searchMemories({
      query: "quick fox",
      topK: 5,
      includeReferences: false,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.content).toContain("quick brown fox");
  });

  it("reports analytics and system status", async () => {
    const analyticsRepository = new AnalyticsRepository(db);
    const jobRepository = new JobRepository(db);
    const analyticsService = new DefaultAnalyticsService({ repository: analyticsRepository });
    analyticsService.recordMetric({
      timestamp: Date.now(),
      queryMs: 10,
      cacheHit: false,
      resultCount: 3,
    });

    const metrics = analyticsService.listRecentMetrics();
    expect(metrics[0]?.resultCount).toBe(3);

    const systemService = new DefaultSystemService({
      config: loadConfig({}, { useDotenv: false }),
      vectra,
      jobRepository,
    });

    const status = await systemService.status();
    expect(status.vectra.ok).toBe(true);
  });
});

