import pino, { type Logger, type LoggerOptions } from "pino";
import type { Config } from "../config";

export type AppLogger = Logger;

export interface CreateLoggerOptions extends LoggerOptions {
  /**
   * Override the default log level derived from configuration.
   */
  level?: LoggerOptions["level"];
}

export function createLogger(
  config: Config,
  options: CreateLoggerOptions = {},
): AppLogger {
  const { level, ...rest } = options;

  return pino({
    level: level ?? config.logLevel,
    base: {
      service: "memorizedmcp-ts",
      environment: config.env,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...rest,
  });
}

