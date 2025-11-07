import { BaseRepository } from "./base";
import type { JobRecord } from "./types";

interface JobRow {
  name: string;
  last_run?: number | null;
  status: string;
  metadata: string;
}

export class JobRepository extends BaseRepository {
  upsert(job: JobRecord): JobRecord {
    this.db.run(
      `INSERT INTO jobs (name, last_run, status, metadata)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         last_run = excluded.last_run,
         status = excluded.status,
         metadata = excluded.metadata;`,
      [
        job.name,
        job.lastRun ?? null,
        job.status,
        this.stringifyJson(job.metadata),
      ],
    );

    return this.assertFound(
      this.findByName(job.name),
      `Failed to load job ${job.name}`,
    );
  }

  markRun(
    name: string,
    status: string,
    metadata: Record<string, unknown> = {},
    ranAt = Date.now(),
  ): JobRecord {
    this.db.run(
      `INSERT INTO jobs (name, last_run, status, metadata)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         last_run = excluded.last_run,
         status = excluded.status,
         metadata = excluded.metadata;`,
      [name, ranAt, status, this.stringifyJson(metadata)],
    );

    return this.assertFound(
      this.findByName(name),
      `Failed to load job ${name}`,
    );
  }

  findByName(name: string): JobRecord | undefined {
    const row = this.db.get<JobRow>(
      "SELECT * FROM jobs WHERE name = ? LIMIT 1;",
      [name],
    );
    return row ? this.#map(row) : undefined;
  }

  list(): JobRecord[] {
    const rows = this.db.all<JobRow>(
      "SELECT * FROM jobs ORDER BY name ASC;",
    );
    return rows.map((row) => this.#map(row));
  }

  #map(row: JobRow): JobRecord {
    return {
      name: row.name,
      lastRun: row.last_run ?? undefined,
      status: row.status,
      metadata: this.parseJson<Record<string, unknown>>(row.metadata, {}),
    };
  }
}

