import process from "node:process";
import path from "node:path";
import { loadConfig, resetConfigCache } from "./config";
import { createLogger } from "./logging";
import { createAppContainer } from "./container";
import { startMcpServer } from "./server/mcp";
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
  const version = process.env.npm_package_version ?? "1.1.0";

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
    "  -e, --env KEY=VALUE      Inject additional environment variables (repeatable)",
    "  -h, --help               Show this help message",
    "",
    "Examples:",
    "  memorizedmcp-ts --multi-tool",
    "  memorizedmcp-ts --config ./prod.env --env LOG_LEVEL=debug",
  ];

  console.log(lines.join("\n"));
}
