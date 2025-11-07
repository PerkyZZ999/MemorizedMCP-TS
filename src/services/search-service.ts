import { MemoryRepository } from "../repositories/memory-repository";
import type { SQLiteClient } from "../database/sqlite";
import type { VectraAdapter } from "../vector/vectra";
import {
  MemorySearchRequestSchema,
  MemorySearchResultSchema,
  type MemorySearchRequest,
  type MemorySearchResult,
} from "../schemas/memory";
import { HybridSearchResultSchema, type HybridSearchResult } from "../schemas/search";
import type { SearchService } from "./types";

export interface SearchServiceDependencies {
  memoryRepository: MemoryRepository;
  sqlite: SQLiteClient;
  vectra: VectraAdapter;
}

interface ScoredMemory {
  id: string;
  vectorScore?: number;
  textScore?: number;
}

export class DefaultSearchService implements SearchService {
  #memoryRepository: MemoryRepository;
  #sqlite: SQLiteClient;
  #vectra: VectraAdapter;

  constructor(deps: SearchServiceDependencies) {
    this.#memoryRepository = deps.memoryRepository;
    this.#sqlite = deps.sqlite;
    this.#vectra = deps.vectra;
  }

  async searchMemories(request: MemorySearchRequest): Promise<HybridSearchResult[]> {
    const parsed = MemorySearchRequestSchema.parse(request);
    const results = await this.#collectScores(parsed);

    const limited = results.slice(0, parsed.topK);
    const enriched: HybridSearchResult[] = [];

    for (const result of limited) {
      const record = this.#memoryRepository.findById(result.id);
      if (!record) {
        continue;
      }
      const references = parsed.includeReferences ?? true
        ? this.#memoryRepository.listReferences(result.id)
        : undefined;

      const dto = MemorySearchResultSchema.parse({
        ...record,
        references,
        score: this.#combineScores(result),
        vectorScore: result.vectorScore,
        textScore: result.textScore,
      });

      enriched.push(
        HybridSearchResultSchema.parse({
          ...dto,
          source: this.#resolveSource(result),
        }),
      );
    }

    return enriched;
  }

  async #collectScores(request: MemorySearchRequest): Promise<ScoredMemory[]> {
    const vectorPromise = request.queryVector
      ? this.#vectra.queryMemories(request.queryVector, {
          topK: request.topK,
          layer: request.layers?.[0],
          minImportance: request.minImportance,
          query: request.query,
          useKeywordFallback: false,
        })
      : Promise.resolve([]);

    const [vectorResults, textResults] = await Promise.all([
      vectorPromise,
      request.query ? this.#searchFts(request) : Promise.resolve([]),
    ]);

    const merged = new Map<string, ScoredMemory>();

    for (const match of vectorResults) {
      merged.set(match.id, {
        id: match.id,
        vectorScore: match.score,
      });
    }

    for (const match of textResults) {
      const existing = merged.get(match.id);
      if (existing) {
        existing.textScore = Math.max(existing.textScore ?? 0, match.score);
      } else {
        merged.set(match.id, { id: match.id, textScore: match.score });
      }
    }

    return Array.from(merged.values()).sort(
      (a, b) => this.#combineScores(b) - this.#combineScores(a),
    );
  }

  async #searchFts(request: MemorySearchRequest): Promise<Array<{ id: string; score: number }>> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (request.layers?.length) {
      conditions.push(`m.layer IN (${request.layers.map(() => "?").join(",")})`);
      params.push(...request.layers);
    }

    if (request.sessionId) {
      conditions.push("m.session_id = ?");
      params.push(request.sessionId);
    }

    if (request.episodeId) {
      conditions.push("m.episode_id = ?");
      params.push(request.episodeId);
    }

    let whereClause = "";
    if (conditions.length) {
      whereClause = `AND ${conditions.join(" AND ")}`;
    }

    const query = this.#sanitizeFts(request.query ?? "");

    const rows = this.#sqlite.all<{ id: string; score: number }>(
      `
      SELECT m.id as id, bm25(fts_memories) as score
      FROM fts_memories
      JOIN memories m ON m.id = fts_memories.memory_id
      WHERE fts_memories MATCH ?
      ${whereClause}
      ORDER BY score ASC
      LIMIT ?
      `,
      [query, ...params, request.topK],
    );

    return rows.map((row) => ({
      id: row.id,
      // bm25 returns lower score for better match; invert to align with cosine
      score: row.score !== 0 ? 1 / row.score : 1,
    }));
  }

  #sanitizeFts(input: string): string {
    if (!input.trim()) {
      return "*";
    }
    return input
      .trim()
      .split(/\s+/)
      .map((token) => `${token}*`)
      .join(" ");
  }

  #combineScores(result: ScoredMemory): number {
    const vector = result.vectorScore ?? 0;
    const text = result.textScore ?? 0;
    if (vector && text) {
      return vector * 0.7 + text * 0.3;
    }
    return vector || text;
  }

  #resolveSource(result: ScoredMemory): "vector" | "text" | "graph" {
    if (result.vectorScore && result.textScore) {
      return "vector";
    }
    if (result.vectorScore) {
      return "vector";
    }
    if (result.textScore) {
      return "text";
    }
    return "graph";
  }
}

