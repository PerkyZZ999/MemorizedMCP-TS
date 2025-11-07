import type { ServiceRegistry } from "../services/types";

const AsyncFunction = Object.getPrototypeOf(async function () {
  /* noop */
}).constructor as typeof Function;

export interface SandboxOptions {
  timeoutMs: number;
}

export interface SandboxResult {
  logs: string[];
  result: unknown;
}

const defaultOptions: SandboxOptions = {
  timeoutMs: 120_000,
};

export async function executeUserCode(
  code: string,
  services: ServiceRegistry,
  options: Partial<SandboxOptions> = {},
): Promise<SandboxResult> {
  const merged = { ...defaultOptions, ...options };
  if (!code.trim()) {
    throw new Error("Code snippet is empty.");
  }

  const transpiler = new Bun.Transpiler({
    loader: "ts",
    target: "bun",
  });

  let jsCode: string;
  try {
    const tsWrapped = `
async function __userSnippet(services, console) {
${code}
}
export default __userSnippet;
`;
    jsCode = await transpiler.transform(tsWrapped);
    jsCode = sanitizeTranspiled(jsCode)
      .replace(/export\s*\{\s*__userSnippet\s+as\s+default\s*\};?/g, "return __userSnippet;")
      .replace(/export\s+default\s+__userSnippet;?/g, "return __userSnippet;");
  } catch (error) {
    throw new Error(`Failed to transpile TypeScript snippet: ${(error as Error).message}`);
  }

  const sandboxConsole = createSandboxConsole();

  try {
    const factory = new AsyncFunction(`"use strict";\n${jsCode}`);
    const snippet = await factory();

    if (typeof snippet !== "function") {
      throw new Error("The provided snippet did not return an executable function.");
    }

    const execution = snippet(
      createServiceProxy(services),
      sandboxConsole.console,
    );

    const result = await withTimeout(execution, merged.timeoutMs);
    return {
      logs: sandboxConsole.flush(),
      result,
    };
  } catch (error) {
    throw normalizeSandboxError(error);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs).unref?.();

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function createServiceProxy(services: ServiceRegistry): ServiceRegistry {
  return new Proxy(services, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });
}

function normalizeSandboxError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function createSandboxConsole() {
  const logs: string[] = [];

  const capture =
    (level: "log" | "info" | "warn" | "error") =>
    (...args: unknown[]) => {
      const text = args
        .map((value) =>
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
        )
        .join(" ");
      logs.push(`[${level}] ${text}`);
    };

  return {
    console: {
      log: capture("log"),
      info: capture("info"),
      warn: capture("warn"),
      error: capture("error"),
    },
    flush: () => logs.splice(0, logs.length),
  };
}

function sanitizeTranspiled(source: string): string {
  return source.replace(/^\s*export\s*\{\s*\};?\s*$/gm, "");
}

