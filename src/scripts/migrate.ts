import path from "node:path";
import { loadConfig } from "../config";
import { applyMigrations } from "../database/migrations";
import { createSQLiteClient } from "../database/sqlite";
import { createLogger } from "../logging";

export async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const migrationsDir = path.resolve(process.cwd(), "sql", "migrations");

  const client = createSQLiteClient({
    filepath: config.sqlite.url,
  });

  try {
    const result = await applyMigrations(client, migrationsDir);

    if (result.applied.length === 0) {
      logger.info(
        {
          migrationsDir,
          database: config.sqlite.url,
        },
        "No pending migrations.",
      );
    } else {
      for (const name of result.applied) {
        logger.info({ migration: name }, "Applied migration");
      }
    }
  } finally {
    client.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
}

