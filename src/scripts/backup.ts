import { runBackupScript } from "../operations/backup";

export async function main(): Promise<void> {
  await runBackupScript();
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Backup script failed:", error);
    process.exit(1);
  });
}

