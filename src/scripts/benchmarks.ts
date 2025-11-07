import { performance } from "node:perf_hooks";
import { createAppContainer } from "../container";

export async function main(): Promise<void> {
  process.env.TRANSFORMER_MODEL = process.env.TRANSFORMER_MODEL ?? "hash";
  const container = await createAppContainer();
  const { services } = container;

  try {
    const ingestDurations: number[] = [];
    const searchDurations: number[] = [];

    for (let i = 0; i < 3; i += 1) {
      const docStart = performance.now();
      const doc = await services.document.ingest({
        content: `Benchmark document ${i} ` + "x".repeat(5_000),
        metadata: { title: `Benchmark ${i}` },
        options: { chunkSize: 512, chunkOverlap: 32, detectEntities: false },
      });
      ingestDurations.push(performance.now() - docStart);

      const searchStart = performance.now();
      await services.search.searchMemories({
        query: "Benchmark",
        topK: 5,
      });
      searchDurations.push(performance.now() - searchStart);

      services.analytics.recordMetric({
        timestamp: Date.now(),
        queryMs: searchDurations[searchDurations.length - 1]!,
        cacheHit: false,
        resultCount: doc.chunkCount,
      });
    }

    const ingestionAvg = average(ingestDurations);
    const searchAvg = average(searchDurations);

    console.log(
      JSON.stringify(
        {
          ingestionMs: ingestionAvg,
          searchMs: searchAvg,
          iterations: ingestDurations.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await container.shutdown();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Benchmark script failed:", error);
    process.exit(1);
  });
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

