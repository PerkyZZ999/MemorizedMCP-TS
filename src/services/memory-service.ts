import { randomUUID } from "node:crypto";
import { MemoryRepository } from "../repositories/memory-repository";
import { MemoryRecordSchema, MemorySearchRequestSchema, MemorySearchResultSchema, type MemoryRecordDTO, type MemorySearchRequest } from "../schemas/memory";
import type { VectraAdapter } from "../vector/vectra";
import type { EmbeddingProvider, MemoryService, SearchService } from "./types";

export interface MemoryServiceDependencies {
  memoryRepository: MemoryRepository;
  vectra: VectraAdapter;
  embeddings: EmbeddingProvider;
  searchService: SearchService;
}

export class DefaultMemoryService implements MemoryService {
  #memoryRepository: MemoryRepository;
  #vectra: VectraAdapter;
  #embeddings: EmbeddingProvider;
  #searchService: SearchService;

  constructor(deps: MemoryServiceDependencies) {
    this.#memoryRepository = deps.memoryRepository;
    this.#vectra = deps.vectra;
    this.#embeddings = deps.embeddings;
    this.#searchService = deps.searchService;
  }

  async addMemory(input: {
    content: string;
    layer: string;
    metadata?: Record<string, unknown>;
    importance?: number;
    sessionId?: string;
    episodeId?: string;
    summary?: string;
  }) {
    const vector = await this.#embeddings.embed([input.content]);
    const importance = input.importance ?? 0.5;
    const now = Date.now();

    const created = await this.#memoryRepository.create(
      {
        id: randomUUID(),
        content: input.content,
        layer: input.layer as any,
        metadata: input.metadata ?? {},
        importance,
        sessionId: input.sessionId ?? null,
        episodeId: input.episodeId ?? null,
        summary: input.summary ?? null,
        createdAt: now,
        updatedAt: now,
      },
      [],
    );

    await this.#vectra.upsertMemoryVector({
      memoryId: created.id,
      vector: vector[0]!,
      layer: created.layer,
      importance,
    });

    const dto = MemoryRecordSchema.parse({
      ...created,
      references: this.#memoryRepository.listReferences(created.id),
    });

    return dto;
  }

  async updateMemory(id: string, patch: Partial<MemoryRecordDTO>) {
    const updated = await this.#memoryRepository.update(id, patch as any);

    if (patch.content) {
      const vector = await this.#embeddings.embed([patch.content]);
      await this.#vectra.upsertMemoryVector({
        memoryId: id,
        vector: vector[0]!,
        layer: updated.layer,
        importance: updated.importance,
      });
    }

    return MemoryRecordSchema.parse({
      ...updated,
      references: this.#memoryRepository.listReferences(updated.id),
    });
  }

  async deleteMemory(id: string): Promise<void> {
    this.#memoryRepository.delete(id);
    await this.#vectra.deleteMemoryVector(id);
  }

  async searchMemories(request: MemorySearchRequest) {
    const parsed = MemorySearchRequestSchema.parse(request);
    const enriched = { ...parsed };

    if (!enriched.queryVector && enriched.query) {
      const [vector] = await this.#embeddings.embed([enriched.query]);
      enriched.queryVector = vector;
    }

    const results = await this.#searchService.searchMemories(enriched);
    return results.map((result) => MemorySearchResultSchema.parse(result));
  }
}

