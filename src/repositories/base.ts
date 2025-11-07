import { NotFoundError } from "../database/errors";
import type { SQLiteClient } from "../database/sqlite";

export abstract class BaseRepository {
  protected readonly db: SQLiteClient;

  protected constructor(db: SQLiteClient) {
    this.db = db;
  }

  protected parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== "string") {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  protected stringifyJson(value: unknown): string {
    return JSON.stringify(value ?? {});
  }

  protected assertFound<T>(
    record: T | undefined,
    message: string,
  ): T {
    if (!record) {
      throw new NotFoundError(message);
    }
    return record;
  }
}

