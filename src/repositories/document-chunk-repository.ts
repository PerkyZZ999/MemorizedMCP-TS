import { randomUUID } from "node:crypto";
import { BaseRepository } from "./base";
import type {
  DocumentChunkRecord,
  NewDocumentChunkRecord,
} from "./types";

interface DocumentChunkRow {
  id: string;
  doc_id: string;
  position_start: number;
  position_end: number;
  page?: number | null;
  content: string;
  summary?: string | null;
  embedding_id?: string | null;
  metadata: string;
}

export class DocumentChunkRepository extends BaseRepository {
  insert(chunk: NewDocumentChunkRecord): DocumentChunkRecord {
    const record: DocumentChunkRecord = {
      id: chunk.id ?? randomUUID(),
      docId: chunk.docId,
      positionStart: chunk.positionStart,
      positionEnd: chunk.positionEnd,
      page: chunk.page ?? undefined,
      content: chunk.content,
      summary: chunk.summary ?? undefined,
      embeddingId: chunk.embeddingId ?? undefined,
      metadata: chunk.metadata ?? {},
    };

    this.db.run(
      `INSERT INTO doc_chunks (
        id, doc_id, position_start, position_end, page, content, summary,
        embedding_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.docId,
        record.positionStart,
        record.positionEnd,
        record.page ?? null,
        record.content,
        record.summary ?? null,
        record.embeddingId ?? null,
        this.stringifyJson(record.metadata),
      ],
    );

    return this.assertFound(
      this.findById(record.id),
      `Failed to load document chunk ${record.id}`,
    );
  }

  update(
    id: string,
    patch: Partial<Omit<DocumentChunkRecord, "id" | "docId">>,
  ): DocumentChunkRecord {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (typeof patch.positionStart === "number") {
      fields.push("position_start = ?");
      params.push(patch.positionStart);
    }

    if (typeof patch.positionEnd === "number") {
      fields.push("position_end = ?");
      params.push(patch.positionEnd);
    }

    if ("page" in patch) {
      fields.push("page = ?");
      params.push(patch.page ?? null);
    }

    if (typeof patch.content === "string") {
      fields.push("content = ?");
      params.push(patch.content);
    }

    if ("summary" in patch) {
      fields.push("summary = ?");
      params.push(patch.summary ?? null);
    }

    if ("embeddingId" in patch) {
      fields.push("embedding_id = ?");
      params.push(patch.embeddingId ?? null);
    }

    if (patch.metadata) {
      fields.push("metadata = ?");
      params.push(this.stringifyJson(patch.metadata));
    }

    if (fields.length > 0) {
      params.push(id);
      this.db.run(`UPDATE doc_chunks SET ${fields.join(", ")} WHERE id = ?;`, params);
    }

    return this.assertFound(
      this.findById(id),
      `Document chunk ${id} not found after update`,
    );
  }

  delete(id: string): void {
    this.db.run("DELETE FROM doc_chunks WHERE id = ?;", [id]);
  }

  deleteByDocument(docId: string): void {
    this.db.run("DELETE FROM doc_chunks WHERE doc_id = ?;", [docId]);
  }

  findById(id: string): DocumentChunkRecord | undefined {
    const row = this.db.get<DocumentChunkRow>(
      "SELECT * FROM doc_chunks WHERE id = ? LIMIT 1;",
      [id],
    );
    return row ? this.#map(row) : undefined;
  }

  listByDocument(docId: string): DocumentChunkRecord[] {
    const rows = this.db.all<DocumentChunkRow>(
      `SELECT * FROM doc_chunks
       WHERE doc_id = ?
       ORDER BY position_start ASC;`,
      [docId],
    );
    return rows.map((row) => this.#map(row));
  }

  #map(row: DocumentChunkRow): DocumentChunkRecord {
    return {
      id: row.id,
      docId: row.doc_id,
      positionStart: row.position_start,
      positionEnd: row.position_end,
      page: row.page ?? undefined,
      content: row.content,
      summary: row.summary ?? undefined,
      embeddingId: row.embedding_id ?? undefined,
      metadata: this.parseJson<Record<string, unknown>>(row.metadata, {}),
    };
  }
}

