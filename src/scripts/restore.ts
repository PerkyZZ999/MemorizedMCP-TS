import { runRestoreScript } from "../operations/backup";

export async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    console.error("Usage: bun run src/scripts/restore.ts <backup-directory>");
    process.exit(1);
  }

  await runRestoreScript(source);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Restore script failed:", error);
    process.exit(1);
  });
}

