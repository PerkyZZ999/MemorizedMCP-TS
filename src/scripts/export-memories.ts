import { createWriteStream } from "node:fs";
import { stdout } from "node:process";
import { createAppContainer } from "../container";

const BATCH_SIZE = 500;

export async function main(): Promise<void> {
  const outputPath = process.argv[2];
  const writer = outputPath ? createWriteStream(outputPath, "utf8") : stdout;

  const container = await createAppContainer();

  try {
    let offset = 0;
    while (true) {
      const batch = container.repositories.memory.listAll(BATCH_SIZE, offset);
      if (batch.length === 0) {
        break;
      }

      for (const record of batch) {
        writer.write(`${JSON.stringify(record)}\n`);
      }

      offset += batch.length;
      if (batch.length < BATCH_SIZE) {
        break;
      }
    }
    if (writer !== stdout) {
      writer.end();
    }
  } finally {
    await container.shutdown();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Memory export failed:", error);
    process.exit(1);
  });
}

