import { mkdirp, pathExists, copy, writeJson, remove, readdir } from "fs-extra";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig, type Config } from "../config";
import { createLogger, type AppLogger } from "../logging";

export interface BackupManifest {
  id: string;
  createdAt: string;
  dataRoot: string;
  includes: string[];
  version: string;
}

export interface BackupResult {
  path: string;
  manifest: BackupManifest;
}

const DIRECTORIES_TO_BACKUP = ["sqlite", "vectors", "documents", "cache"];

export async function createBackupSnapshot(config: Config, logger: AppLogger): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(config.dataRoot, "backups");
  const backupDir = path.join(backupRoot, `${timestamp}-${randomUUID().slice(0, 8)}`);
  await mkdirp(backupDir);

  const included: string[] = [];
  for (const dir of DIRECTORIES_TO_BACKUP) {
    const source = path.join(config.dataRoot, dir);
    if (!(await pathExists(source))) {
      continue;
    }
    const destination = path.join(backupDir, dir);
    await copy(source, destination, { overwrite: true, errorOnExist: false });
    included.push(dir);
  }

  const manifest: BackupManifest = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    dataRoot: config.dataRoot,
    includes: included,
    version: process.env.npm_package_version ?? "0.1.0",
  };

  await writeJson(path.join(backupDir, "manifest.json"), manifest, { spaces: 2 });

  logger.info({ backupDir }, "Backup snapshot created");
  return { path: backupDir, manifest };
}

export async function restoreFromSnapshot(
  config: Config,
  logger: AppLogger,
  sourceDir: string,
): Promise<void> {
  const resolvedSource = path.resolve(sourceDir);
  if (!(await pathExists(resolvedSource))) {
    throw new Error(`Backup source "${resolvedSource}" does not exist`);
  }

  // Remove existing directories to avoid mixing stale data.
  for (const dir of DIRECTORIES_TO_BACKUP) {
    const target = path.join(config.dataRoot, dir);
    if (await pathExists(target)) {
      await remove(target);
    }
  }

  const entries = await readdir(resolvedSource);
  for (const entry of entries) {
    if (entry === "manifest.json") {
      continue;
    }
    const source = path.join(resolvedSource, entry);
    const destination = path.join(config.dataRoot, entry);
    await copy(source, destination, { overwrite: true, errorOnExist: false });
  }

  logger.info({ source: resolvedSource }, "Backup restoration complete");
}

// Helper script harnesses ----------------------------

export async function runBackupScript(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  await createBackupSnapshot(config, logger);
}

export async function runRestoreScript(source: string): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  await restoreFromSnapshot(config, logger, source);
}

