import { randomUUID } from "node:crypto";
import { BaseRepository } from "./base";
import type {
  DocumentRecord,
  NewDocumentRecord,
} from "./types";

interface DocumentRow {
  id: string;
  hash: string;
  source_path?: string | null;
  mime?: string | null;
  title?: string | null;
  metadata: string;
  ingested_at: number;
  size_bytes: number;
}

export class DocumentRepository extends BaseRepository {
  create(input: NewDocumentRecord): DocumentRecord {
    const now = Date.now();
    const record: Required<NewDocumentRecord> = {
      id: input.id ?? randomUUID(),
      hash: input.hash,
      sourcePath: input.sourcePath ?? null,
      mime: input.mime ?? null,
      title: input.title ?? null,
      metadata: input.metadata ?? {},
      ingestedAt: input.ingestedAt ?? now,
      sizeBytes: input.sizeBytes ?? 0,
    };

    this.db.run(
      `INSERT INTO documents (
        id, hash, source_path, mime, title, metadata, ingested_at, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.hash,
        record.sourcePath,
        record.mime,
        record.title,
        this.stringifyJson(record.metadata),
        record.ingestedAt,
        record.sizeBytes,
      ],
    );

    return this.assertFound(
      this.findById(record.id),
      `Failed to load document ${record.id}`,
    );
  }

  update(id: string, patch: Partial<NewDocumentRecord>): DocumentRecord {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (patch.hash) {
      fields.push("hash = ?");
      params.push(patch.hash);
    }

    if ("sourcePath" in patch) {
      fields.push("source_path = ?");
      params.push(patch.sourcePath ?? null);
    }

    if ("mime" in patch) {
      fields.push("mime = ?");
      params.push(patch.mime ?? null);
    }

    if ("title" in patch) {
      fields.push("title = ?");
      params.push(patch.title ?? null);
    }

    if (patch.metadata) {
      fields.push("metadata = ?");
      params.push(this.stringifyJson(patch.metadata));
    }

    if (typeof patch.ingestedAt === "number") {
      fields.push("ingested_at = ?");
      params.push(patch.ingestedAt);
    }

    if (typeof patch.sizeBytes === "number") {
      fields.push("size_bytes = ?");
      params.push(patch.sizeBytes);
    }

    if (fields.length > 0) {
      params.push(id);
      this.db.run(`UPDATE documents SET ${fields.join(", ")} WHERE id = ?;`, params);
    }

    return this.assertFound(
      this.findById(id),
      `Document ${id} not found after update`,
    );
  }

  delete(id: string): void {
    this.db.run("DELETE FROM documents WHERE id = ?;", [id]);
  }

  findById(id: string): DocumentRecord | undefined {
    const row = this.db.get<DocumentRow>(
      "SELECT * FROM documents WHERE id = ? LIMIT 1;",
      [id],
    );
    return row ? this.#mapDocument(row) : undefined;
  }

  findByHash(hash: string): DocumentRecord | undefined {
    const row = this.db.get<DocumentRow>(
      "SELECT * FROM documents WHERE hash = ? LIMIT 1;",
      [hash],
    );
    return row ? this.#mapDocument(row) : undefined;
  }

  list(limit = 100, offset = 0): DocumentRecord[] {
    const rows = this.db.all<DocumentRow>(
      `SELECT * FROM documents
       ORDER BY ingested_at DESC
       LIMIT ? OFFSET ?;`,
      [limit, offset],
    );
    return rows.map((row) => this.#mapDocument(row));
  }

  #mapDocument(row: DocumentRow): DocumentRecord {
    return {
      id: row.id,
      hash: row.hash,
      sourcePath: row.source_path ?? undefined,
      mime: row.mime ?? undefined,
      title: row.title ?? undefined,
      metadata: this.parseJson<Record<string, unknown>>(row.metadata, {}),
      ingestedAt: row.ingested_at,
      sizeBytes: row.size_bytes,
    };
  }

}

