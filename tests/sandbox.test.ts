import { describe, expect, it } from "vitest";
import { executeUserCode } from "../src/server/sandbox";
import type { ServiceRegistry } from "../src/services/types";

const fakeServices: ServiceRegistry = {
  document: {} as any,
  memory: {
    addMemory: async ({ content }: { content: string }) => ({
      id: "mem-1",
      content,
    }),
    updateMemory: async () => undefined,
    deleteMemory: async () => undefined,
    searchMemories: async () => [],
  } as any,
  knowledge: {} as any,
  search: {
    searchMemories: async () => [{ id: "mem-1", score: 1 }],
  } as any,
  analytics: {
    recordMetric: () => {},
    listRecentMetrics: () => [],
  },
  system: {
    status: async () => ({ ok: true }),
  } as any,
};

describe("executeUserCode", () => {
  it("executes TypeScript and returns structured result", async () => {
    const result = await executeUserCode(
      `
      const memory = await services.memory.addMemory({
        content: "sandbox-test",
        layer: "stm",
      });
      return memory.id;
    `,
      fakeServices,
      { timeoutMs: 1_000 },
    );

    expect(result.result).toBe("mem-1");
    expect(result.logs).toEqual([]);
  });

  it("captures console output", async () => {
    const result = await executeUserCode(
      `
      console.log("one");
      console.warn("two");
      return 42;
    `,
      fakeServices,
      { timeoutMs: 1_000 },
    );

      expect(result.logs).toEqual([
        "[log] one",
        "[warn] two",
      ]);
    expect(result.result).toBe(42);
  });

  it("honors timeout", async () => {
    await expect(
      executeUserCode(
        `
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      `,
        fakeServices,
        { timeoutMs: 50 },
      ),
    ).rejects.toThrow("Execution timed out");
  });
});

