import { randomUUID } from "node:crypto";
import { BaseRepository } from "./base";
import type {
  MemoryLayer,
  MemoryRecord,
  MemoryReferenceInput,
  NewMemoryRecord,
} from "./types";

interface MemoryRow {
  id: string;
  layer: string;
  content: string;
  metadata: string;
  created_at: number;
  updated_at: number;
  importance: number;
  session_id?: string | null;
  episode_id?: string | null;
  summary?: string | null;
  embedding_id?: string | null;
}

interface MemoryReferenceRow {
  doc_id: string;
  chunk_id?: string | null;
  score?: number | null;
  relation?: string | null;
}

export class MemoryRepository extends BaseRepository {
  async create(
    input: NewMemoryRecord,
    references: MemoryReferenceInput[] = [],
  ): Promise<MemoryRecord> {
    const now = Date.now();
    const record: Required<NewMemoryRecord> = {
      id: input.id ?? randomUUID(),
      layer: input.layer,
      content: input.content,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      importance: input.importance ?? 0.5,
      sessionId: input.sessionId ?? null,
      episodeId: input.episodeId ?? null,
      summary: input.summary ?? null,
      embeddingId: input.embeddingId ?? null,
    };

    this.db.run(
      `INSERT INTO memories (
        id, layer, content, metadata, created_at, updated_at, importance,
        session_id, episode_id, summary, embedding_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.layer,
        record.content,
        this.stringifyJson(record.metadata),
        record.createdAt,
        record.updatedAt,
        record.importance,
        record.sessionId,
        record.episodeId,
        record.summary,
        record.embeddingId,
      ],
    );

    if (references.length > 0) {
      await this.replaceReferences(record.id, references);
    }

    return this.assertFound(
      this.findById(record.id),
      `Failed to load memory ${record.id} after insert`,
    );
  }

  async update(
    id: string,
    patch: Partial<NewMemoryRecord>,
  ): Promise<MemoryRecord> {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (patch.layer) {
      fields.push("layer = ?");
      params.push(patch.layer);
    }

    if (typeof patch.content === "string") {
      fields.push("content = ?");
      params.push(patch.content);
    }

    if (patch.metadata) {
      fields.push("metadata = ?");
      params.push(this.stringifyJson(patch.metadata));
    }

    if (typeof patch.importance === "number") {
      fields.push("importance = ?");
      params.push(patch.importance);
    }

    if ("sessionId" in patch) {
      fields.push("session_id = ?");
      params.push(patch.sessionId ?? null);
    }

    if ("episodeId" in patch) {
      fields.push("episode_id = ?");
      params.push(patch.episodeId ?? null);
    }

    if ("summary" in patch) {
      fields.push("summary = ?");
      params.push(patch.summary ?? null);
    }

    if ("embeddingId" in patch) {
      fields.push("embedding_id = ?");
      params.push(patch.embeddingId ?? null);
    }

    const timestamp = Date.now();
    fields.push("updated_at = ?");
    params.push(timestamp);
    params.push(id);

    if (fields.length > 0) {
      this.db.run(
        `UPDATE memories SET ${fields.join(", ")} WHERE id = ?;`,
        params,
      );
    }

    return this.assertFound(
      this.findById(id),
      `Memory ${id} not found after update`,
    );
  }

  delete(id: string): void {
    this.db.run("DELETE FROM memories WHERE id = ?;", [id]);
  }

  findById(id: string): MemoryRecord | undefined {
    const row = this.db.get<MemoryRow>(
      "SELECT * FROM memories WHERE id = ? LIMIT 1;",
      [id],
    );
    return row ? this.#mapRow(row) : undefined;
  }

  listByLayer(layer: MemoryLayer, limit = 50): MemoryRecord[] {
    const rows = this.db.all<MemoryRow>(
      `SELECT * FROM memories
       WHERE layer = ?
       ORDER BY created_at DESC
       LIMIT ?;`,
      [layer, limit],
    );
    return rows.map((row) => this.#mapRow(row));
  }

  listReferences(memoryId: string): MemoryReferenceInput[] {
    const rows = this.db.all<MemoryReferenceRow>(
      `SELECT doc_id, chunk_id, score, relation
       FROM memory_refs
       WHERE memory_id = ?
       ORDER BY doc_id, chunk_id;`,
      [memoryId],
    );

    return rows.map((row) => ({
      docId: row.doc_id,
      chunkId: row.chunk_id ?? undefined,
      score: row.score ?? undefined,
      relation: row.relation ?? undefined,
    }));
  }

  async replaceReferences(
    memoryId: string,
    references: MemoryReferenceInput[],
  ): Promise<void> {
    const normalized = references.map((ref) => ({
      docId: ref.docId,
      chunkId: ref.chunkId ?? null,
      score: ref.score ?? null,
      relation: ref.relation ?? null,
    }));

    await this.db.transaction(async (trx) => {
      trx.run("DELETE FROM memory_refs WHERE memory_id = ?;", [memoryId]);

      for (const ref of normalized) {
        trx.run(
          `INSERT INTO memory_refs (memory_id, doc_id, chunk_id, score, relation)
           VALUES (?, ?, ?, ?, ?);`,
          [memoryId, ref.docId, ref.chunkId, ref.score, ref.relation],
        );
      }
    });
  }

  removeReference(memoryId: string, docId: string, chunkId?: string | null): void {
    if (chunkId) {
      this.db.run(
        `DELETE FROM memory_refs
         WHERE memory_id = ? AND doc_id = ? AND chunk_id = ?;`,
        [memoryId, docId, chunkId],
      );
    } else {
      this.db.run(
        `DELETE FROM memory_refs
         WHERE memory_id = ? AND doc_id = ? AND chunk_id IS NULL;`,
        [memoryId, docId],
      );
    }
  }

  listAll(limit = 500, offset = 0): MemoryRecord[] {
    const rows = this.db.all<MemoryRow>(
      `SELECT * FROM memories
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?;`,
      [limit, offset],
    );

    return rows.map((row) => this.#mapRow(row));
  }

  searchByEntityName(entityName: string, limit = 100): MemoryRecord[] {
    // Use FTS5 to search for entity name in memory content
    const rows = this.db.all<{ memory_id: string }>(
      `SELECT memory_id FROM fts_memories
       WHERE fts_memories MATCH ?
       LIMIT ?;`,
      [entityName, limit],
    );

    if (rows.length === 0) {
      return [];
    }

    const memoryIds = rows.map((row) => row.memory_id);
    const placeholders = memoryIds.map(() => "?").join(",");
    const memoryRows = this.db.all<MemoryRow>(
      `SELECT * FROM memories WHERE id IN (${placeholders});`,
      memoryIds,
    );

    return memoryRows.map((row) => this.#mapRow(row));
  }

  #mapRow(row: MemoryRow): MemoryRecord {
    return {
      id: row.id,
      layer: row.layer as MemoryLayer,
      content: row.content,
      metadata: this.parseJson<Record<string, unknown>>(row.metadata, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      importance: row.importance,
      sessionId: row.session_id ?? undefined,
      episodeId: row.episode_id ?? undefined,
      summary: row.summary ?? undefined,
      embeddingId: row.embedding_id ?? undefined,
    };
  }
}

