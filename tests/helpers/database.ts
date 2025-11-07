import path from "node:path";
import { applyMigrations } from "../../src/database/migrations";
import { createSQLiteClient, type SQLiteClient } from "../../src/database/sqlite";

export async function createTestSQLite(): Promise<SQLiteClient> {
  const client = createSQLiteClient({ filepath: ":memory:" });
  const migrationsDir = path.resolve(process.cwd(), "sql", "migrations");
  await applyMigrations(client, migrationsDir);
  return client;
}

export function closeTestSQLite(client: SQLiteClient): void {
  client.close();
}

