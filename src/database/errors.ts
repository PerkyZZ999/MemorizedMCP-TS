export type DatabaseErrorCode =
  | "SQLITE_CONSTRAINT"
  | "SQLITE_BUSY"
  | "SQLITE_SCHEMA"
  | "NOT_FOUND"
  | "UNKNOWN";

export interface DatabaseErrorOptions {
  sql?: string;
  params?: unknown[];
  cause?: unknown;
}

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly sql?: string;
  readonly params?: unknown[];

  constructor(message: string, code: DatabaseErrorCode, options: DatabaseErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "DatabaseError";
    this.code = code;
    this.sql = options.sql;
    this.params = options.params;
  }
}

export class NotFoundError extends DatabaseError {
  constructor(message: string, options: DatabaseErrorOptions = {}) {
    super(message, "NOT_FOUND", options);
    this.name = "NotFoundError";
  }
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function normalizeSQLiteError(
  error: unknown,
  context: { sql?: string; params?: unknown[] } = {},
): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    const mappedCode: DatabaseErrorCode = mapSQLiteCode(code);
    return new DatabaseError(error.message, mappedCode, {
      sql: context.sql,
      params: context.params,
      cause: error,
    });
  }

  return new DatabaseError("Unknown SQLite error", "UNKNOWN", {
    sql: context.sql,
    params: context.params,
    cause: error,
  });
}

function mapSQLiteCode(code?: string): DatabaseErrorCode {
  if (!code) {
    return "UNKNOWN";
  }

  switch (code) {
    case "SQLITE_CONSTRAINT":
    case "SQLITE_BUSY":
    case "SQLITE_SCHEMA":
      return code;
    default:
      return "UNKNOWN";
  }
}

