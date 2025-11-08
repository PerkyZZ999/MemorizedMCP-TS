import process from "node:process";
import path from "node:path";
import { loadConfig } from "./config";
import { createLogger } from "./logging";
import { createAppContainer } from "./container";
import { startMcpServer } from "./server/mcp";
import { JobScheduler } from "./jobs/scheduler";
import { buildScheduledJobs } from "./jobs/definitions";

export interface BootstrapResult {
  readonly config: ReturnType<typeof loadConfig>;
  readonly mode: "single-tool" | "multi-tool";
}

export async function bootstrap(): Promise<BootstrapResult> {
  const config = loadConfig();
  const logger = createLogger(config);
  const mode = config.mcp.multiTool ? "multi-tool" : "single-tool";
  const version = process.env.npm_package_version ?? "0.1.0";

  const banner = renderBanner({
    appName: "MemorizedMCP-TS",
    version,
    mode,
  });

  console.error(banner);

  logger.info(
    {
      dataRoot: config.dataRoot,
      sqliteUrl: config.sqlite.url,
      sqliteDir: path.dirname(config.sqlite.url),
      transformerModel: config.transformer.model,
      mcpMode: mode,
      singleToolTimeoutMs: config.mcp.singleToolTimeoutMs,
    },
    "Configuration resolved",
  );

  const container = await createAppContainer({ config, logger });
  logger.info("Running health check of services...");
  await container.services.system.status();
  logger.info("Health check passed.");
  const scheduler = new JobScheduler(logger, container.repositories.jobs);
  for (const job of buildScheduledJobs(container)) {
    scheduler.register(job);
  }
  scheduler.startAll();
  await startMcpServer(container);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info("Shutting down MemorizedMCP-TS...");
    scheduler.stopAll();
    await container.shutdown();
    process.exit(0);
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Received termination signal");
    void shutdown();
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  logger.info({ mode }, "MemorizedMCP-TS server is ready.");

  return { config, mode };
}

if (import.meta.main) {
  bootstrap().catch((error) => {
    console.error("Fatal bootstrap error:", error);
    process.exit(1);
  });
}

interface BannerOptions {
  appName: string;
  version: string;
  mode: "single-tool" | "multi-tool";
}

function renderBanner({ appName, version, mode }: BannerOptions): string {
  const lines = [
    "===============================================",
    `  ${appName} v${version}`,
    `  Mode: ${mode}`,
    "  Status: listening on stdio",
    "===============================================",
  ];

  return `\n${lines.join("\n")}\n`;
}
