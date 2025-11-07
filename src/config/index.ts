import { config as loadEnvFile } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
const ENVIRONMENTS = ["development", "test", "production"] as const;

export const ConfigSchema = z.object({
  env: z.enum(ENVIRONMENTS),
  logLevel: z.enum(LOG_LEVELS),
  dataRoot: z.string(),
  sqlite: z.object({
    url: z.string(),
  }),
  mcp: z.object({
    multiTool: z.boolean(),
    singleToolTimeoutMs: z.number().int().min(1_000).max(600_000),
  }),
  transformer: z.object({
    model: z.string(),
  }),
  vectra: z.object({
    memoryCollection: z.string(),
    documentCollection: z.string(),
  }),
  jobs: z.object({
    consolidateCron: z.string(),
    backupCron: z.string(),
    cleanupCron: z.string(),
    reindexCron: z.string(),
    metricsCron: z.string(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
type ConfigInput = z.input<typeof ConfigSchema>;

export interface LoadConfigOptions {
  /**
   * Explicit .env file location. Pass `false` to skip dotenv entirely.
   */
  envFile?: string | false;
  /**
   * Additional environment variables to overlay (useful for tests).
   */
  envVars?: Record<string, string | undefined>;
  /**
   * Toggle dotenv loading. Defaults to `true`.
   */
  useDotenv?: boolean;
  /**
   * Base directory used when resolving relative paths. Defaults to `process.cwd()`.
   */
  cwd?: string;
}

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export function loadConfig(
  overrides: Partial<ConfigInput> = {},
  options: LoadConfigOptions = {},
): Config {
  const {
    envFile,
    envVars = {},
    useDotenv = true,
    cwd: baseDir = process.cwd(),
  } = options;

  if (useDotenv) {
    const resolvedEnvPath =
      envFile === undefined
        ? path.resolve(baseDir, ".env")
        : envFile === false
          ? undefined
          : envFile;

    if (resolvedEnvPath && existsSync(resolvedEnvPath)) {
      loadEnvFile({ path: resolvedEnvPath });
    }
  }

  const mergedEnv: Record<string, string | undefined> = {
    ...process.env,
    ...envVars,
  };

  const env =
    overrides.env ??
    (mergedEnv.NODE_ENV as ConfigInput["env"]) ??
    "development";

  const dataRoot =
    overrides.dataRoot ?? mergedEnv.DATA_ROOT ?? path.resolve(baseDir, "data");

  const sqliteUrl =
    overrides.sqlite?.url ??
    mergedEnv.SQLITE_URL ??
    path.join(dataRoot, "sqlite", "memorized.db");

  const raw: ConfigInput = {
    env,
    logLevel:
      overrides.logLevel ??
      (mergedEnv.LOG_LEVEL as ConfigInput["logLevel"]) ??
      "info",
    dataRoot,
    sqlite: {
      url: sqliteUrl,
    },
    mcp: {
      multiTool:
        overrides.mcp?.multiTool ??
        coerceBoolean(mergedEnv.MCP_MULTI_TOOL) ??
        false,
      singleToolTimeoutMs:
        overrides.mcp?.singleToolTimeoutMs ??
        coerceInteger(mergedEnv.SINGLE_TOOL_TIMEOUT_MS, 120_000),
    },
    transformer: {
      model:
        overrides.transformer?.model ??
        mergedEnv.TRANSFORMER_MODEL ??
        "Xenova/all-MiniLM-L6-v2",
    },
    vectra: {
      memoryCollection:
        overrides.vectra?.memoryCollection ??
        mergedEnv.VECTRA_COLLECTION_MEM ??
        "memories",
      documentCollection:
        overrides.vectra?.documentCollection ??
        mergedEnv.VECTRA_COLLECTION_DOC ??
        "doc_chunks",
    },
    jobs: {
      consolidateCron:
        overrides.jobs?.consolidateCron ??
        mergedEnv.CRON_CONSOLIDATE ??
        "0 * * * *",
      backupCron:
        overrides.jobs?.backupCron ??
        mergedEnv.CRON_BACKUP ??
        "0 3 * * *",
      cleanupCron:
        overrides.jobs?.cleanupCron ??
        mergedEnv.CRON_CLEANUP ??
        "30 2 * * 0",
      reindexCron:
        overrides.jobs?.reindexCron ??
        mergedEnv.CRON_REINDEX ??
        "0 4 * * *",
      metricsCron:
        overrides.jobs?.metricsCron ??
        mergedEnv.CRON_METRICS ??
        "*/15 * * * *",
    },
  };

  const parsed = ConfigSchema.parse(raw);
  cachedConfig = Object.freeze(parsed);
  return parsed;
}

function coerceBoolean(value?: string | boolean | null): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function coerceInteger(
  value?: string | number | null,
  fallback?: number,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof fallback === "number") {
    return fallback;
  }

  throw new Error("Unable to coerce integer value from input");
}

