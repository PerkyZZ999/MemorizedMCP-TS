import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";

function runServer(code: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const serverPath = path.resolve("src", "index.ts");
    const child = spawn("bun", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        LOG_LEVEL: "error",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.stdin.write(JSON.stringify({ method: "run_code", params: { code } }));
    child.stdin.end(() => {
      setTimeout(() => {
        child.kill("SIGINT");
        resolve({ stdout, stderr });
      }, 100);
    });
  });
}

describe.skip("MCP stdio integration", () => {
  it("can bootstrap and process run_code", async () => {
    const { stdout, stderr } = await runServer(
      `
      console.log("integration");
      return { status: "ok" };
    `,
    );

    expect(stderr).toBe("");
    expect(stdout).toContain("status");
  });
});

