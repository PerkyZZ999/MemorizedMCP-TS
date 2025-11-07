import { createReadStream } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin } from "node:process";
import { createAppContainer } from "../container";

export async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const stream = inputPath ? createReadStream(inputPath, "utf8") : stdin;

  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  const container = await createAppContainer();

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const record = JSON.parse(trimmed) as {
        id: string;
        layer: string;
        content: string;
        metadata?: Record<string, unknown>;
        createdAt: number;
        updatedAt: number;
        importance: number;
        sessionId?: string | null;
        episodeId?: string | null;
        summary?: string | null;
        embeddingId?: string | null;
        references?: Array<{
          docId: string;
          chunkId?: string;
          score?: number;
          relation?: string;
        }>;
      };

      const references = record.references ?? [];
      const existing = container.repositories.memory.findById(record.id);
      if (existing) {
        await container.repositories.memory.update(record.id, {
          layer: record.layer as any,
          content: record.content,
          metadata: record.metadata ?? {},
          importance: record.importance,
          sessionId: record.sessionId ?? undefined,
          episodeId: record.episodeId ?? undefined,
          summary: record.summary ?? undefined,
          embeddingId: record.embeddingId ?? undefined,
        });
        await container.repositories.memory.replaceReferences(record.id, references);
      } else {
        await container.repositories.memory.create(
          {
            id: record.id,
            layer: record.layer as any,
            content: record.content,
            metadata: record.metadata ?? {},
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            importance: record.importance,
            sessionId: record.sessionId ?? null,
            episodeId: record.episodeId ?? null,
            summary: record.summary ?? null,
            embeddingId: record.embeddingId ?? null,
          },
          references,
        );
      }
    }
  } finally {
    await container.shutdown();
    if (inputPath) {
      (stream as NodeJS.ReadableStream).close?.();
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Memory import failed:", error);
    process.exit(1);
  });
}

