import { BaseRepository } from "./base";
import type { TagRecord } from "./types";

interface TagRow {
  name: string;
  description?: string | null;
}

export class TagRepository extends BaseRepository {
  upsert(tag: TagRecord): TagRecord {
    this.db.run(
      `INSERT INTO tags (name, description)
       VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET description = excluded.description;`,
      [tag.name, tag.description ?? null],
    );

    return this.assertFound(
      this.findByName(tag.name),
      `Failed to load tag ${tag.name}`,
    );
  }

  findByName(name: string): TagRecord | undefined {
    const row = this.db.get<TagRow>(
      "SELECT * FROM tags WHERE name = ? LIMIT 1;",
      [name],
    );
    return row ? { name: row.name, description: row.description ?? undefined } : undefined;
  }

  list(): TagRecord[] {
    const rows = this.db.all<TagRow>(
      "SELECT * FROM tags ORDER BY name ASC;",
    );
    return rows.map((row) => ({
      name: row.name,
      description: row.description ?? undefined,
    }));
  }

  delete(name: string): void {
    this.db.run("DELETE FROM tags WHERE name = ?;", [name]);
  }
}

