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
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
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

