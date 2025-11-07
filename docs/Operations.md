# MemorizedMCP-TS Operations & Delivery Guide

## 1. Environments & Setup
- **Runtime**: Bun ≥ 1.1 with TypeScript enabled.
- **OS Support**: macOS, Linux, Windows (WSL recommended). Ensure SQLite built with FTS5.
- **Dependencies**:
  - `bun install` to fetch MCP SDK, Vectra, Transformers.js, unpdf, compromise, node-cron, Pino.
  - First launch downloads Transformers.js model to `<data-root>/cache/transformers`.
- **Configuration**:
  - `.env` stores sensitive overrides (database paths, cron frequencies, model IDs).
  - `bunfig.toml` defines transpilation, module resolution, and runtime flags.
  - `config/default.ts` (planned) merges env + defaults and validates via Zod.

## 2. Process Management
- **Local development**: `bun dev` runs with hot reload (watch mode).
- **Production**: build with `bun build src/index.ts --outdir dist` and execute `bun run dist/server.js` under process manager (systemd, PM2, supervisor).
- **Graceful shutdown**: SIGINT/SIGTERM trigger cleanup—persist queue state, flush SQLite, close Vectra collections, and remove PID file.

## 3. Logging & Observability
- **Pino** logging with structured JSON output; log level controlled by `LOG_LEVEL`.
- Request context includes `requestId`, `toolName`, execution time.
- Optional file transport: configure `LOG_FILE` to enable rotating logs in `<data-root>/logs`.
- Future enhancement: integrate `prom-client` metrics endpoint `/metrics` (documented here for roadmap).

## 4. Background Jobs
| Job | Default Schedule | Description |
|-----|------------------|-------------|
| Consolidation | `0 */2 * * *` (every 2 hours) | Promotes STM → LTM, merges similar memories, refreshes embeddings. |
| Cleanup | `0 3 * * *` (daily) | Removes expired STM, prunes orphaned references, vacuums SQLite/FTS. |
| Backup | `0 1 * * *` (daily) | Snapshot SQLite, Vectra collections, and documents to `<data-root>/backups/{timestamp}`. |
| Reindex | `0 4 * * 0` (weekly) | Rebuilds Vectra indices and FTS tables for long-term health. |
| Metrics Rollup | `*/15 * * * *` | Aggregates search metrics into hourly/daily buckets. |

Jobs registered via `node-cron`; custom schedules overridable through environment variables (e.g., `CRON_BACKUP`).

## 5. Maintenance Procedures
- **Backup**: Use `system.backup` tool or CLI `bun run scripts/backup.ts` to create snapshot; archives stored as `.tar.gz` with manifest.
- **Restore**: Stop server, unpack backup into `<data-root>`, run `system.restore` to reload metadata.
- **Migration**: Provide script `scripts/import-rust-data.ts` to translate sled/tantivy exports into SQLite/Vectra; accompany with manual verification steps.
- **Embedding Cache**: Periodic job cleans stale model cache files, ensuring disk usage manageable.

## 6. Deployment Checklist
1. Confirm Bun runtime version.
2. Set environment variables (`DATA_ROOT`, `TRANSFORMER_MODEL`, cron overrides).
3. Initialize data directories (`sqlite`, `vectors`, `documents`, `cache`, `backups`).
4. Run `bun run scripts/migrate.ts` (future) to create schemas.
5. Execute smoke tests (`bun test --filter smoke`).
6. Register service with process manager.
7. Monitor logs for first-run embedding downloads.

## 7. Testing Strategy
- **Unit Tests**: Zod schema validation, repository CRUD, vector adapter mocks.
- **Integration Tests**: End-to-end memory/document flows under both tool modes.
- **Performance Tests**: Stress hybrid search with seeded dataset; target <250ms latency for top-20 results.
- **Regression Tests**: Ensure API compatibility with legacy clients; compare outputs against Rust server fixtures.
- **CI Pipeline** (planned): GitHub Actions/Bun test matrix + lint (biome/eslint), triggered on PR.

## 8. Roadmap & Milestones
1. **Milestone A – Foundation**
   - Bootstrapped Bun project, configuration, logging, and MCP transport.
   - Stubbed services returning mock data.
2. **Milestone B – Data Layer**
   - SQLite schema creation, repository layer, migrations draft.
   - Vectra integration and embedding pipeline.
3. **Milestone C – Core Features**
   - Memory & document services parity with Rust version.
   - Knowledge graph extraction and search fusion.
4. **Milestone D – Operations**
   - Background jobs, backup/restore tooling, observability enhancements.
   - Documentation completion and migration scripts.
5. **Milestone E – Release Candidate**
   - End-to-end tests, performance tuning, user acceptance, packaging instructions.

## 9. Support & Troubleshooting
- **Common Issues**
  - Missing FTS5: rebuild SQLite or install distribution with FTS5 enabled.
  - Transformers model download failures: pre-fetch model assets or set `TRANSFORMER_CACHE_DIR`.
  - High latency: inspect logs for vector rebuild, adjust Vectra parameters, ensure cron jobs not overlapping.
- **Diagnostics Tools**
  - `system.status` for health summary.
  - `metrics` (future) for Prometheus scrape.
  - Debug logging: set `LOG_LEVEL=debug` for verbose traces.

## 10. Documentation Maintenance
- Keep `README.md` referencing all spec documents.
- Update docs upon schema or operational changes; include doc links in PR templates.
- Track open questions and future enhancements in `docs/Roadmap.md` (planned follow-up).
