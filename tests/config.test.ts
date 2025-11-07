import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadConfig,
  resetConfigCache,
  type LoadConfigOptions,
} from "../src/config";

const DEFAULT_OPTIONS: LoadConfigOptions = {
  useDotenv: false,
  envVars: {},
  cwd: path.resolve(process.cwd()),
};

afterEach(() => {
  resetConfigCache();
});

describe("loadConfig", () => {
  it("uses sensible defaults when no overrides are provided", () => {
    const config = loadConfig({}, { ...DEFAULT_OPTIONS, envVars: { NODE_ENV: undefined } });

    expect(config.env).toBe("development");
    expect(config.logLevel).toBe("info");
    expect(config.dataRoot.endsWith(path.join("data"))).toBe(true);
    expect(config.sqlite.url.endsWith(path.join("data", "sqlite", "memorized.db"))).toBe(true);
    expect(config.mcp.multiTool).toBe(false);
    expect(config.mcp.singleToolTimeoutMs).toBe(120_000);
    expect(config.transformer.model).toBe("Xenova/all-MiniLM-L6-v2");
    expect(config.vectra.memoryCollection).toBe("memories");
    expect(config.vectra.documentCollection).toBe("doc_chunks");
    expect(config.jobs.consolidateCron).toBe("0 * * * *");
    expect(config.jobs.backupCron).toBe("0 3 * * *");
    expect(config.jobs.cleanupCron).toBe("30 2 * * 0");
    expect(config.jobs.reindexCron).toBe("0 4 * * *");
    expect(config.jobs.metricsCron).toBe("*/15 * * * *");
  });

  it("applies environment variable overrides", () => {
    const config = loadConfig(
      {},
      {
        ...DEFAULT_OPTIONS,
        envVars: {
          NODE_ENV: "production",
          LOG_LEVEL: "debug",
          DATA_ROOT: "/tmp/memorized",
          SQLITE_URL: "/tmp/memorized/sqlite/custom.db",
          MCP_MULTI_TOOL: "true",
          SINGLE_TOOL_TIMEOUT_MS: "180000",
          TRANSFORMER_MODEL: "custom/model",
          VECTRA_COLLECTION_MEM: "mem_custom",
          VECTRA_COLLECTION_DOC: "doc_custom",
          CRON_CONSOLIDATE: "*/5 * * * *",
          CRON_BACKUP: "0 1 * * *",
          CRON_CLEANUP: "15 2 * * 1",
          CRON_REINDEX: "0 5 * * *",
          CRON_METRICS: "*/30 * * * *",
        },
      },
    );

    expect(config.env).toBe("production");
    expect(config.logLevel).toBe("debug");
    expect(config.dataRoot).toBe("/tmp/memorized");
    expect(config.sqlite.url).toBe("/tmp/memorized/sqlite/custom.db");
    expect(config.mcp.multiTool).toBe(true);
    expect(config.mcp.singleToolTimeoutMs).toBe(180_000);
    expect(config.transformer.model).toBe("custom/model");
    expect(config.vectra.memoryCollection).toBe("mem_custom");
    expect(config.vectra.documentCollection).toBe("doc_custom");
    expect(config.jobs.consolidateCron).toBe("*/5 * * * *");
    expect(config.jobs.backupCron).toBe("0 1 * * *");
    expect(config.jobs.cleanupCron).toBe("15 2 * * 1");
    expect(config.jobs.reindexCron).toBe("0 5 * * *");
    expect(config.jobs.metricsCron).toBe("*/30 * * * *");
  });

  it("honors explicit override parameters", () => {
    const config = loadConfig(
      {
        env: "test",
        logLevel: "trace",
        mcp: {
          singleToolTimeoutMs: 200_000,
        },
      },
      DEFAULT_OPTIONS,
    );

    expect(config.env).toBe("test");
    expect(config.logLevel).toBe("trace");
    expect(config.mcp.singleToolTimeoutMs).toBe(200_000);
  });

  it("throws when overrides violate schema constraints", () => {
    expect(() =>
      loadConfig(
        {
          mcp: {
            singleToolTimeoutMs: 500,
          },
        },
        DEFAULT_OPTIONS,
      ),
    ).toThrow();
  });
});

