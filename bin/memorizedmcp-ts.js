#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bunExecutable = process.env.BUN_BINARY ?? "bun";
const scriptPath = path.resolve(__dirname, "../dist/index.js");
const cliArgs = process.argv.slice(2);

const child = spawn(bunExecutable, [scriptPath, ...cliArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    MEMORIZEDMCP_PARENT_PID: String(process.pid),
  },
});

let terminating = false;

const terminateChild = (signal) => {
  if (terminating) {
    return;
  }
  terminating = true;

  if (child.exitCode !== null || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", [
      "/F",
      "/T",
      "/PID",
      String(child.pid),
    ]);
    killer.on("error", (error) => {
      console.error(
        "Failed to terminate Bun subprocess via taskkill. You may need to close it manually.",
      );
      console.error(error);
    });
  } else {
    try {
      child.kill(signal ?? "SIGTERM");
    } catch (error) {
      console.error("Failed to signal Bun subprocess during shutdown:", error);
    }
  }
};

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) {
  process.on(signal, () => {
    terminateChild(signal);
  });
}

process.on("exit", () => {
  terminateChild();
});

child.on("exit", (code, signal) => {
  terminating = true;
  if (signal) {
    const normalized =
      signal === "SIGINT"
        ? 130
        : signal === "SIGTERM"
        ? 143
        : code ?? 0;
    process.exit(normalized);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(
    `Failed to launch Bun executable "${bunExecutable}". Ensure Bun (>=1.3.0) is installed and available on your PATH (or set BUN_BINARY).`,
  );
  console.error(error);
  process.exit(1);
});

