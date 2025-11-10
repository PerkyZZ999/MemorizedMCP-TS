import { randomUUID } from "node:crypto";
import { BaseRepository } from "./base";
import type {
  KnowledgeEdgeRecord,
  KnowledgeEntityRecord,
  NewKnowledgeEdgeRecord,
  NewKnowledgeEntityRecord,
} from "./types";

interface EntityRow {
  id: string;
  name: string;
  type: string;
  count: number;
  first_seen: number;
  last_seen: number;
  tags: string;
}

interface EdgeRow {
  id: string;
  src: string;
  dst: string;
  relation: string;
  weight?: number | null;
  created_at: number;
  metadata: string;
}

export class KnowledgeGraphRepository extends BaseRepository {
  upsertEntity(input: NewKnowledgeEntityRecord): KnowledgeEntityRecord {
    const now = Date.now();
    const record: Required<NewKnowledgeEntityRecord> = {
      id: input.id ?? randomUUID(),
      name: input.name,
      type: input.type,
      count: input.count ?? 0,
      firstSeen: input.firstSeen ?? now,
      lastSeen: input.lastSeen ?? now,
      tags: input.tags ?? [],
    };

    this.db.run(
      `INSERT INTO entities (id, name, type, count, first_seen, last_seen, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         type = excluded.type,
         count = excluded.count,
         first_seen = MIN(first_seen, excluded.first_seen),
         last_seen = MAX(last_seen, excluded.last_seen),
         tags = excluded.tags;`,
      [
        record.id,
        record.name,
        record.type,
        record.count,
        record.firstSeen,
        record.lastSeen,
        JSON.stringify(record.tags),
      ],
    );

    return this.assertFound(
      this.findByName(record.name),
      `Failed to load entity ${record.name}`,
    );
  }

  updateEntityActivity(id: string, lastSeen?: number, countIncrement = 1): KnowledgeEntityRecord {
    const timestamp = lastSeen ?? Date.now();
    this.db.run(
      `UPDATE entities
       SET last_seen = MAX(last_seen, ?),
           count = count + ?
       WHERE id = ?;`,
      [timestamp, countIncrement, id],
    );

    return this.assertFound(
      this.findById(id),
      `Entity ${id} not found after activity update`,
    );
  }

  setEntityTags(id: string, tags: string[]): KnowledgeEntityRecord {
    this.db.run(
      `UPDATE entities SET tags = ? WHERE id = ?;`,
      [JSON.stringify(tags), id],
    );
    return this.assertFound(
      this.findById(id),
      `Entity ${id} not found after tag update`,
    );
  }

  updateEntity(id: string, updates: {
    name?: string;
    type?: string;
    tags?: string[];
  }): KnowledgeEntityRecord {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      params.push(updates.name);
    }
    if (updates.type !== undefined) {
      fields.push("type = ?");
      params.push(updates.type);
    }
    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      params.push(JSON.stringify(updates.tags));
    }

    if (fields.length > 0) {
      params.push(id);
      this.db.run(
        `UPDATE entities SET ${fields.join(", ")} WHERE id = ?;`,
        params,
      );
    }

    return this.assertFound(
      this.findById(id),
      `Entity ${id} not found after update`,
    );
  }

  deleteEntity(id: string): void {
    this.db.run("DELETE FROM entities WHERE id = ?;", [id]);
  }

  findById(id: string): KnowledgeEntityRecord | undefined {
    const row = this.db.get<EntityRow>(
      "SELECT * FROM entities WHERE id = ? LIMIT 1;",
      [id],
    );
    return row ? this.#mapEntity(row) : undefined;
  }

  findByName(name: string): KnowledgeEntityRecord | undefined {
    const row = this.db.get<EntityRow>(
      "SELECT * FROM entities WHERE name = ? LIMIT 1;",
      [name],
    );
    return row ? this.#mapEntity(row) : undefined;
  }

  listEntities(limit = 100, offset = 0): KnowledgeEntityRecord[] {
    const rows = this.db.all<EntityRow>(
      `SELECT * FROM entities
       ORDER BY last_seen DESC
       LIMIT ? OFFSET ?;`,
      [limit, offset],
    );
    return rows.map((row) => this.#mapEntity(row));
  }

  searchEntitiesByName(name: string, limit = 100, offset = 0): KnowledgeEntityRecord[] {
    // Use FTS5 for name search
    const rows = this.db.all<{ entity_id: string }>(
      `SELECT entity_id FROM fts_entities
       WHERE fts_entities MATCH ?
       LIMIT ? OFFSET ?;`,
      [name, limit, offset],
    );

    if (rows.length === 0) {
      return [];
    }

    const entityIds = rows.map((row) => row.entity_id);
    const placeholders = entityIds.map(() => "?").join(",");
    const entityRows = this.db.all<EntityRow>(
      `SELECT * FROM entities WHERE id IN (${placeholders});`,
      entityIds,
    );

    return entityRows.map((row) => this.#mapEntity(row));
  }

  findEntitiesByType(type: string, limit = 100, offset = 0): KnowledgeEntityRecord[] {
    const rows = this.db.all<EntityRow>(
      `SELECT * FROM entities
       WHERE type = ?
       ORDER BY last_seen DESC
       LIMIT ? OFFSET ?;`,
      [type, limit, offset],
    );
    return rows.map((row) => this.#mapEntity(row));
  }

  findEntitiesByTag(tag: string, limit = 100, offset = 0): KnowledgeEntityRecord[] {
    // Search for entities that have the tag in their tags JSON array
    // Using json_each to properly search JSON arrays
    const rows = this.db.all<EntityRow>(
      `SELECT DISTINCT e.* FROM entities e
       JOIN json_each(e.tags) AS j
       WHERE j.value = ?
       ORDER BY e.last_seen DESC
       LIMIT ? OFFSET ?;`,
      [tag, limit, offset],
    );
    return rows.map((row) => this.#mapEntity(row));
  }

  getAllTags(): string[] {
    // Get all unique tags from entities
    const rows = this.db.all<{ tag: string }>(
      `SELECT DISTINCT j.value AS tag
       FROM entities e
       JOIN json_each(e.tags) AS j
       ORDER BY j.value ASC;`,
    );
    return rows.map((row) => row.tag);
  }

  upsertEdge(input: NewKnowledgeEdgeRecord): KnowledgeEdgeRecord {
    const record: KnowledgeEdgeRecord = {
      id: input.id ?? randomUUID(),
      src: input.src,
      dst: input.dst,
      relation: input.relation,
      weight: input.weight ?? null,
      createdAt: input.createdAt ?? Date.now(),
      metadata: input.metadata ?? {},
    };

    this.db.run(
      `INSERT INTO kg_edges (id, src, dst, relation, weight, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         src = excluded.src,
         dst = excluded.dst,
         relation = excluded.relation,
         weight = excluded.weight,
         metadata = excluded.metadata;`,
      [
        record.id,
        record.src,
        record.dst,
        record.relation,
        record.weight,
        record.createdAt,
        this.stringifyJson(record.metadata),
      ],
    );

    return this.assertFound(
      this.findEdgeById(record.id),
      `Failed to load edge ${record.id}`,
    );
  }

  findEdgeById(id: string): KnowledgeEdgeRecord | undefined {
    const row = this.db.get<EdgeRow>(
      "SELECT * FROM kg_edges WHERE id = ? LIMIT 1;",
      [id],
    );
    return row ? this.#mapEdge(row) : undefined;
  }

  listEdgesForEntity(entityId: string): KnowledgeEdgeRecord[] {
    const rows = this.db.all<EdgeRow>(
      `SELECT * FROM kg_edges
       WHERE src = ? OR dst = ?
       ORDER BY created_at DESC;`,
      [entityId, entityId],
    );
    return rows.map((row) => this.#mapEdge(row));
  }

  getEdgesByEntityAndType(entityId: string, relationType?: string): KnowledgeEdgeRecord[] {
    let query = `SELECT * FROM kg_edges
                 WHERE (src = ? OR dst = ?)`;
    const params: unknown[] = [entityId, entityId];

    if (relationType) {
      query += ` AND relation = ?`;
      params.push(relationType);
    }

    query += ` ORDER BY created_at DESC;`;

    const rows = this.db.all<EdgeRow>(query, params);
    return rows.map((row) => this.#mapEdge(row));
  }

  searchEdgesByRelation(relationType: string, limit = 100, offset = 0): KnowledgeEdgeRecord[] {
    const rows = this.db.all<EdgeRow>(
      `SELECT * FROM kg_edges
       WHERE relation = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?;`,
      [relationType, limit, offset],
    );
    return rows.map((row) => this.#mapEdge(row));
  }

  deleteEdge(id: string): void {
    this.db.run("DELETE FROM kg_edges WHERE id = ?;", [id]);
  }

  #mapEntity(row: EntityRow): KnowledgeEntityRecord {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      count: row.count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      tags: this.parseJson<string[]>(row.tags, []),
    };
  }

  #mapEdge(row: EdgeRow): KnowledgeEdgeRecord {
    return {
      id: row.id,
      src: row.src,
      dst: row.dst,
      relation: row.relation,
      weight: row.weight ?? undefined,
      createdAt: row.created_at,
      metadata: this.parseJson<Record<string, unknown>>(row.metadata, {}),
    };
  }
}

