import { Database, type Statement } from "bun:sqlite";
import { ensureDirSync } from "fs-extra";
import path from "node:path";
import { DatabaseError, normalizeSQLiteError } from "./errors";

export interface SQLiteTelemetryEvent {
  sql: string;
  durationMs: number;
}

export interface SQLiteConnectionOptions {
  filepath: string;
  readonly?: boolean;
  busyTimeoutMs?: number;
  telemetry?: (event: SQLiteTelemetryEvent) => void;
}

export class SQLiteClient {
  #db: Database;
  #telemetry?: (event: SQLiteTelemetryEvent) => void;

  constructor(options: SQLiteConnectionOptions) {
    const { filepath, readonly = false, busyTimeoutMs = 5000, telemetry } = options;
    this.#telemetry = telemetry;

    const isInMemory =
      filepath === ":memory:" || filepath.startsWith("file:");

    if (!isInMemory) {
      const directory = path.dirname(filepath);
      ensureDirSync(directory);
    }

    try {
      this.#db = new Database(filepath, {
        create: !readonly,
        readonly,
      });
    } catch (error) {
      throw normalizeSQLiteError(error, { sql: "open-database" });
    }

    try {
      this.exec("PRAGMA journal_mode=WAL;");
      this.exec("PRAGMA foreign_keys=ON;");
      this.exec(`PRAGMA busy_timeout=${busyTimeoutMs};`);
      this.exec("PRAGMA synchronous=NORMAL;");
    } catch (error) {
      throw normalizeSQLiteError(error, { sql: "configure-database" });
    }
  }

  get native(): Database {
    return this.#db;
  }

  close(): void {
    this.#db.close();
  }

  exec(sql: string): void {
    this.#measure(sql, () => {
      this.#db.exec(sql);
      return undefined;
    });
  }

  run(sql: string, params: unknown[] = []): void {
    const statement = this.prepare(sql);
    try {
      this.#measure(sql, () => {
        statement.run(...params);
        return undefined;
      }, params);
    } finally {
      statement.finalize();
    }
  }

  get<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
    const statement = this.prepare<T>(sql);
    try {
      return this.#measure(sql, () => statement.get(...params), params);
    } finally {
      statement.finalize();
    }
  }

  all<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const statement = this.prepare<T>(sql);
    try {
      return this.#measure(sql, () => statement.all(...params), params);
    } finally {
      statement.finalize();
    }
  }

  prepare<T = unknown>(sql: string): Statement<T> {
    try {
      return this.#db.prepare<T>(sql);
    } catch (error) {
      throw normalizeSQLiteError(error, { sql });
    }
  }

  async transaction<T>(
    fn: (client: SQLiteClient) => Promise<T> | T,
  ): Promise<T> {
    this.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const result = await fn(this);
      this.exec("COMMIT;");
      return result;
    } catch (error) {
      try {
        this.exec("ROLLBACK;");
      } catch (rollbackError) {
        throw new DatabaseError("Failed to rollback transaction", "UNKNOWN", {
          cause: rollbackError,
        });
      }
      throw error;
    }
  }

  protected #measure<T>(
    sql: string,
    fn: () => T,
    params: unknown[] = [],
  ): T {
    const start = performance.now();
    try {
      return fn();
    } catch (error) {
      throw normalizeSQLiteError(error, { sql, params });
    } finally {
      if (this.#telemetry) {
        const durationMs = performance.now() - start;
        this.#telemetry({ sql, durationMs });
      }
    }
  }
}

export function createSQLiteClient(options: SQLiteConnectionOptions): SQLiteClient {
  return new SQLiteClient(options);
}

