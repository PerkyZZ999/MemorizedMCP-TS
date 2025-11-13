import process from "node:process";
import path from "node:path";
import { loadConfig, resetConfigCache } from "./config";
import { createLogger } from "./logging";
import { createAppContainer } from "./container";
import { startMcpServer } from "./server/mcp";
import type { McpServerHandle } from "./server/mcp";
import { JobScheduler } from "./jobs/scheduler";
import { buildScheduledJobs } from "./jobs/definitions";

export interface BootstrapResult {
  readonly config: ReturnType<typeof loadConfig>;
  readonly mode: "single-tool" | "multi-tool";
}

export interface BootstrapOptions {
  readonly envFile?: string | false;
  readonly envVars?: Record<string, string | undefined>;
}

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const { envFile, envVars } = options;
  const config = loadConfig({}, { envFile, envVars });
  const logger = createLogger(config);
  const mode = config.mcp.multiTool ? "multi-tool" : "single-tool";
  const version = process.env.npm_package_version ?? "1.1.6";

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

  let shuttingDown = false;
  let transportHandle: McpServerHandle["transport"] | undefined;
  let parentCheckInterval: NodeJS.Timeout | undefined;

  function handleStdinEnd(): void {
    logger.info("STDIN ended; initiating shutdown.");
    void shutdown("stdio-stdin-end");
  }

  function handleStdinClose(): void {
    logger.info("STDIN closed; initiating shutdown.");
    void shutdown("stdio-stdin-close");
  }

  function handleStdinError(error: unknown): void {
    logger.warn({ error }, "STDIN error detected; initiating shutdown.");
    void shutdown("stdio-stdin-error");
  }

  const removeStdioListeners = () => {
    const stdin = process.stdin;
    if (typeof stdin.off === "function") {
      stdin.off("end", handleStdinEnd);
      stdin.off("close", handleStdinClose);
      stdin.off("error", handleStdinError);
    } else {
      stdin.removeListener("end", handleStdinEnd);
      stdin.removeListener("close", handleStdinClose);
      stdin.removeListener("error", handleStdinError);
    }
  };

  const shutdown = async (reason?: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    if (parentCheckInterval) {
      clearInterval(parentCheckInterval);
      parentCheckInterval = undefined;
    }

    removeStdioListeners();

    if (reason) {
      logger.info({ reason }, "Shutting down MemorizedMCP-TS...");
    } else {
      logger.info("Shutting down MemorizedMCP-TS...");
    }

    let exitCode = 0;

    try {
      scheduler.stopAll();
    } catch (error) {
      exitCode = 1;
      logger.error({ error }, "Failed to stop scheduled jobs");
    }

    if (transportHandle && reason !== "stdio-transport-closed") {
      try {
        await transportHandle.close();
      } catch (error) {
        logger.warn(
          { error },
          "Failed to close MCP stdio transport gracefully; continuing shutdown",
        );
      }
    }

    try {
      await container.shutdown();
    } catch (error) {
      exitCode = 1;
      logger.error({ error }, "Error during container shutdown");
    }

    process.exit(exitCode);
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Received termination signal");
    void shutdown(`signal:${signal}`);
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  if (typeof process.once === "function" && process.platform === "win32") {
    // Handle Ctrl+Break on Windows
    process.once("SIGBREAK", handleSignal);
  }

  const stdin = process.stdin;
  stdin.on("end", handleStdinEnd);
  stdin.on("close", handleStdinClose);
  stdin.on("error", handleStdinError);
  stdin.resume();

  const parentPidValue = process.env.MEMORIZEDMCP_PARENT_PID;
  const parentPid = parentPidValue
    ? Number.parseInt(parentPidValue, 10)
    : undefined;

  if (parentPid !== undefined && !Number.isNaN(parentPid)) {
    const checkParentAlive = () => {
      try {
        process.kill(parentPid, 0);
      } catch (error) {
        logger.warn(
          { error, parentPid },
          "Detected missing parent process; initiating shutdown.",
        );
        void shutdown("parent-process-gone");
      }
    };
    parentCheckInterval = setInterval(checkParentAlive, 5_000);
    if (typeof parentCheckInterval.unref === "function") {
      parentCheckInterval.unref();
    }
  }

  const { transport } = await startMcpServer(container);
  transportHandle = transport;
  transport.onclose = () => {
    logger.info(
      "MCP stdio transport closed; shutting down MemorizedMCP-TS server.",
    );
    void shutdown("stdio-transport-closed");
  };
  transport.onerror = (error) => {
    logger.error({ error }, "MCP stdio transport error");
    void shutdown("stdio-transport-error");
  };

  logger.info({ mode }, "MemorizedMCP-TS server is ready.");

  return { config, mode };
}

if (import.meta.main) {
  let cli: CliParseResult;
  try {
    cli = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    printHelp();
    process.exit(1);
  }

  if (cli.showHelp) {
    printHelp();
    process.exit(0);
  }

  if (cli.multiTool === true) {
    cli.envVars.MCP_MULTI_TOOL = "true";
  } else if (cli.multiTool === false) {
    cli.envVars.MCP_MULTI_TOOL = "false";
  }

  for (const [key, value] of Object.entries(cli.envVars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetConfigCache();

  bootstrap({
    envFile: cli.envFile,
    envVars: cli.envVars,
  }).catch((error) => {
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

interface CliParseResult {
  envFile?: string | false;
  envVars: Record<string, string | undefined>;
  multiTool?: boolean;
  showHelp: boolean;
}

function parseCliArgs(argv: string[]): CliParseResult {
  const result: CliParseResult = {
    envVars: {},
    showHelp: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case "--":
        return result;
      case "-h":
      case "--help":
        result.showHelp = true;
        return result;
      case "-c":
      case "--config": {
        const value = argv[i + 1];
        if (!value) {
          throw new Error("Missing value for --config");
        }
        result.envFile =
          value.toLowerCase() === "false"
            ? false
            : path.resolve(process.cwd(), value);
        i += 1;
        break;
      }
      case "--multi-tool":
        result.multiTool = true;
        break;
      case "--single-tool":
        result.multiTool = false;
        break;
      case "-e":
      case "--env": {
        const value = argv[i + 1];
        if (!value || !value.includes("=")) {
          throw new Error("Expected KEY=VALUE after --env");
        }
        const [key, ...rest] = value.split("=");
        result.envVars[key] = rest.join("=");
        i += 1;
        break;
      }
      case "-p":
      case "--path": {
        const value = argv[i + 1];
        if (!value) {
          throw new Error("Missing value for --path");
        }
        result.envVars.DATA_ROOT = value;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

function printHelp(): void {
  const lines = [
    "Usage: memorizedmcp-ts [options]",
    "",
    "Options:",
    "  -c, --config <path>      Load environment variables from the specified .env file",
    "      --multi-tool         Force multi-tool mode (sets MCP_MULTI_TOOL=true)",
    "      --single-tool        Force single-tool mode (sets MCP_MULTI_TOOL=false)",
    "  -p, --path <dir>         Override DATA_ROOT for SQLite/vectors/backups",
    "  -e, --env KEY=VALUE      Inject additional environment variables (repeatable)",
    "  -h, --help               Show this help message",
    "",
    "Examples:",
    "  memorizedmcp-ts --multi-tool",
    "  memorizedmcp-ts --config ./prod.env --env LOG_LEVEL=debug",
    "  memorizedmcp-ts --path ./.memorized",
  ];

  console.log(lines.join("\n"));
}
