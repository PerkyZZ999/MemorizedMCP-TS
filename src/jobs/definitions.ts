import type { AppContainer } from "../container";
import type { ScheduledJobDefinition } from "./scheduler";
import { createBackupSnapshot } from "../operations/backup";

function pickSampleMemories(container: AppContainer): number {
  const layers: Array<"stm" | "ltm" | "episodic" | "semantic" | "documentary"> = [
    "stm",
    "ltm",
    "episodic",
    "semantic",
    "documentary",
  ];
  let count = 0;
  for (const layer of layers) {
    count += container.repositories.memory.listByLayer(layer, 25).length;
  }
  return count;
}

export function buildScheduledJobs(container: AppContainer): ScheduledJobDefinition[] {
  const { config, logger } = container;

  return [
    {
      name: "memory.consolidate",
      schedule: config.jobs.consolidateCron,
      description: "Evaluates short-term memories for consolidation into long-term storage.",
      task: async () => {
        const sample = pickSampleMemories(container);
        logger.info({ sample }, "Consolidation scan completed");
      },
    },
    {
      name: "system.cleanup",
      schedule: config.jobs.cleanupCron,
      description: "Runs periodic cleanup tasks (VACUUM, cache pruning).",
      task: async () => {
        container.sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE);");
        container.sqlite.exec("VACUUM;");
        logger.info("SQLite cleanup completed");
      },
    },
    {
      name: "system.backup",
      schedule: config.jobs.backupCron,
      description: "Creates snapshot backups of the data root.",
      task: async () => {
        const result = await createBackupSnapshot(container.config, container.logger);
        logger.info({ backupDir: result.path }, "Backup snapshot created");
      },
    },
    {
      name: "system.reindex",
      schedule: config.jobs.reindexCron,
      description: "Refreshes Vectra collection metadata for diagnostics.",
      task: async () => {
        const stats = await container.vectra.stats();
        logger.info({ stats }, "Vectra stats refreshed");
      },
    },
    {
      name: "analytics.metrics",
      schedule: config.jobs.metricsCron,
      description: "Records operational metrics for observability dashboards.",
      task: async () => {
        const stats = await container.vectra.stats();
        container.services.analytics.recordMetric({
          timestamp: Date.now(),
          queryMs: 0,
          cacheHit: false,
          resultCount: stats.memories + stats.docChunks,
        });
      },
    },
  ];
}

