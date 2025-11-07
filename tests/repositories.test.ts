import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repositories/memory-repository";
import { DocumentRepository } from "../src/repositories/document-repository";
import { DocumentChunkRepository } from "../src/repositories/document-chunk-repository";
import { KnowledgeGraphRepository } from "../src/repositories/knowledge-graph-repository";
import { TagRepository } from "../src/repositories/tag-repository";
import { AnalyticsRepository } from "../src/repositories/analytics-repository";
import { JobRepository } from "../src/repositories/job-repository";
import type { SQLiteClient } from "../src/database/sqlite";
import { closeTestSQLite, createTestSQLite } from "./helpers/database";

let db: SQLiteClient;

beforeEach(async () => {
  db = await createTestSQLite();
});

afterEach(() => {
  closeTestSQLite(db);
});

describe("Repositories integration", () => {
  it("creates and updates memories with references", async () => {
    const memoryRepo = new MemoryRepository(db);
    const documentRepo = new DocumentRepository(db);
    const chunkRepo = new DocumentChunkRepository(db);

    const doc = documentRepo.create({
      hash: "hash-1",
      metadata: { name: "Test" },
    });

    const chunk = chunkRepo.insert({
      id: "chunk-1",
      docId: doc.id,
      content: "Chunk content",
      positionStart: 0,
      positionEnd: 12,
      metadata: {},
    });

    const memory = await memoryRepo.create(
      {
        layer: "stm",
        content: "Remember this",
        metadata: { topic: "alpha" },
      },
      [
        {
          docId: doc.id,
          chunkId: chunk.id,
          relation: "evidence",
          score: 0.9,
        },
      ],
    );

    expect(memory.layer).toBe("stm");
    expect(memory.metadata.topic).toBe("alpha");

    const references = memoryRepo.listReferences(memory.id);
    expect(references).toHaveLength(1);
    expect(references[0].docId).toBe(doc.id);

    const updated = await memoryRepo.update(memory.id, {
      layer: "ltm",
      importance: 0.8,
    });

    expect(updated.layer).toBe("ltm");
    expect(updated.importance).toBeCloseTo(0.8);
  });

  it("manages documents and chunks", () => {
    const documentRepo = new DocumentRepository(db);
    const chunkRepo = new DocumentChunkRepository(db);

    const doc = documentRepo.create({
      hash: "hash-2",
      title: "Test Document",
      metadata: { category: "notes" },
    });

    expect(documentRepo.findByHash("hash-2")?.id).toBe(doc.id);

    const chunk = chunkRepo.insert({
      docId: doc.id,
      positionStart: 0,
      positionEnd: 50,
      content: "Lorem ipsum dolor sit amet.",
      metadata: { sentence: 1 },
    });

    const chunks = chunkRepo.listByDocument(doc.id);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe(chunk.id);

    const updatedChunk = chunkRepo.update(chunk.id, {
      summary: "Summary",
    });
    expect(updatedChunk.summary).toBe("Summary");
  });

  it("tracks knowledge graph entities and edges", () => {
    const kgRepo = new KnowledgeGraphRepository(db);

    const entity = kgRepo.upsertEntity({
      name: "Memorized MCP",
      type: "project",
      tags: ["memory"],
    });

    expect(entity.name).toBe("Memorized MCP");
    expect(entity.tags).toContain("memory");

    const updated = kgRepo.updateEntityActivity(entity.id, Date.now(), 2);
    expect(updated.count).toBe(entity.count + 2);

    kgRepo.setEntityTags(entity.id, ["memory", "mcp"]);
    const tagged = kgRepo.findById(entity.id);
    expect(tagged?.tags).toEqual(["memory", "mcp"]);

    const edge = kgRepo.upsertEdge({
      src: entity.id,
      dst: entity.id,
      relation: "self",
      metadata: { weight: 1 },
    });

    const edges = kgRepo.listEdgesForEntity(entity.id);
    expect(edges.map((e) => e.id)).toContain(edge.id);
  });

  it("manages tags and analytics metrics", () => {
    const tagRepo = new TagRepository(db);
    const analyticsRepo = new AnalyticsRepository(db);

    tagRepo.upsert({ name: "priority", description: "High priority" });
    tagRepo.upsert({ name: "context" });

    const tags = tagRepo.list();
    expect(tags).toHaveLength(2);

    tagRepo.delete("context");
    expect(tagRepo.list()).toHaveLength(1);

    const now = Date.now();
    analyticsRepo.record({
      timestamp: now,
      queryMs: 123.4,
      cacheHit: true,
      resultCount: 5,
    });

    const metrics = analyticsRepo.listRecent();
    expect(metrics[0]?.cacheHit).toBe(true);
  });

  it("tracks job executions", () => {
    const jobRepo = new JobRepository(db);

    jobRepo.upsert({
      name: "reindex",
      status: "idle",
      metadata: {},
    });

    const run = jobRepo.markRun("reindex", "running", { batch: 1 }, 123);
    expect(run.lastRun).toBe(123);
    expect(run.status).toBe("running");

    const listed = jobRepo.list();
    expect(listed).toHaveLength(1);
  });
});

