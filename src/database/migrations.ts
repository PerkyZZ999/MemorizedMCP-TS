import { promises as fs } from "node:fs";
import path from "node:path";
import { createSQLiteClient, type SQLiteClient } from "./sqlite";

export interface Migration {
  name: string;
  filepath: string;
  sql: string;
}

export interface ApplyMigrationsResult {
  applied: string[];
  skipped: string[];
}

const MIGRATIONS_TABLE = "schema_migrations";

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const resolvedDirectory = path.resolve(directory);
  const entries = await fs.readdir(resolvedDirectory);

  const sqlFiles = entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const migrations: Migration[] = [];
  for (const file of sqlFiles) {
    const filepath = path.join(resolvedDirectory, file);
    const sql = await fs.readFile(filepath, "utf-8");
    migrations.push({
      name: file,
      filepath,
      sql,
    });
  }

  return migrations;
}

export async function applyMigrations(
  client: SQLiteClient,
  directory: string,
): Promise<ApplyMigrationsResult> {
  const migrations = await loadMigrations(directory);
  if (migrations.length === 0) {
    return { applied: [], skipped: [] };
  }

  client.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );`,
  );

  const appliedRows = client.all<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE};`,
  );
  const appliedSet = new Set(appliedRows.map((row) => row.name));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    if (appliedSet.has(migration.name)) {
      skipped.push(migration.name);
      continue;
    }

    await client.transaction(async (trx) => {
      trx.exec(migration.sql);
      trx.run(
        `INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES (?, ?);`,
        [migration.name, Date.now()],
      );
    });

    applied.push(migration.name);
  }

  return { applied, skipped };
}

export async function migrateDatabase(
  filepath: string,
  options: { directory: string },
): Promise<ApplyMigrationsResult> {
  const client = createSQLiteClient({ filepath });
  try {
    return await applyMigrations(client, options.directory);
  } finally {
    client.close();
  }
}

