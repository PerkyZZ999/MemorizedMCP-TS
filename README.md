# MemorizedMCP-TS

MemorizedMCP-TS is the Bun + TypeScript rewrite of the Memorized MCP server. The project targets a single-tool MCP execution experience with a config-driven multi-tool fallback mode, hybrid memory infrastructure (SQLite + Vectra + knowledge graph), and robust operational tooling.

- [`docs/Requirements.md`](docs/Requirements.md) — goals, scope, and non-functional requirements.
- [`docs/Architecture.md`](docs/Architecture.md) — topology, module breakdown, transport diagrams.
- [`docs/Data-Model.md`](docs/Data-Model.md) — relational schema, vector storage, lifecycle workflows.
- [`docs/API.md`](docs/API.md) — tool contracts, schema governance, configuration parameters.
- [`docs/Operations.md`](docs/Operations.md) — deployment guidance, background jobs, roadmap milestones.

## Getting Started

1. **Install dependencies**
   ```sh
   bun install
   ```
2. **Bootstrap configuration**  
   The server reads configuration from environment variables (Bun auto-loads `.env`). Copy `.env.example` when it becomes available or define values directly in your environment.
3. **Run the bootstrap entrypoint**
   ```sh
   bun run dev
   ```
   The stub entrypoint resolves configuration, initializes structured logging, and prints a readiness banner. Transport wiring and service orchestration land in later phases of the roadmap.

## Scripts

- `bun run dev` — run the entrypoint with file watching.
- `bun run build` — bundle the server to `dist/`.
- `bun run start` — execute the bundled output (after build).
- `bun run lint` — static analysis with Biome.
- `bun run format` — auto-format the repository.
- `bun run test` — execute Vitest test suites.
- `bun run test:watch` — Vitest in watch mode.
- `bun run generate-schemas` — generate JSON Schema artefacts from Zod definitions.
- `bun run migrate` — migration runner for SQLite/Vectra.
- `bun run bench` — quick ingestion/search benchmark (see `src/scripts/benchmarks.ts`).
- `bun run backup` — snapshot the current data root into `backups/`.
- `bun run restore -- <dir>` — restore a snapshot created via `backup`.
- `bun run export:memories -- <file>` — export memories as JSONL (defaults to stdout).
- `bun run import:memories -- <file>` — import memories from JSONL.

## MCP Usage

- Run the MCP server via `bun run dev` (or `bun run start` after building). The server listens over stdio by default, performs a health check, and starts cron jobs.
- Single-tool mode exposes a `run_code` tool that executes TypeScript snippets with pre-bound clients: `services.memory`, `services.document`, `services.search`, etc. Console output and returned values are surfaced in the response.
- Set `MCP_MULTI_TOOL=true` to register discrete tools (`memory.add`, `memory.search`, `document.store`, `document.retrieve`, `document.list`, `knowledge.list_entities`, `system.status`) alongside `run_code`.
- JSON schemas for the public tool inputs/outputs can be regenerated with `bun run generate-schemas` (written to `generated/schemas/`).

## Configuration Overview

Configuration merges defaults, `.env`, and runtime overrides via the `loadConfig` helper in `src/config/`. Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment label | `development` |
| `LOG_LEVEL` | Pino log level | `info` |
| `DATA_ROOT` | Root directory for persisted artefacts | `<project>/data` |
| `SQLITE_URL` | SQLite database path | `<DATA_ROOT>/sqlite/memorized.db` |
| `MCP_MULTI_TOOL` | Enable multi-tool registry mode | `false` |
| `SINGLE_TOOL_TIMEOUT_MS` | Sandbox default timeout | `120000` |
| `TRANSFORMER_MODEL` | Transformers.js model ID | `Xenova/all-MiniLM-L6-v2` |
| `VECTRA_COLLECTION_MEM` | Vectra collection for memories | `memories` |
| `VECTRA_COLLECTION_DOC` | Vectra collection for document chunks | `doc_chunks` |
| `CRON_CONSOLIDATE` | Consolidation job schedule | `0 * * * *` |
| `CRON_BACKUP` | Backup job schedule | `0 3 * * *` |
| `CRON_CLEANUP` | Cleanup/VACUUM job schedule | `30 2 * * 0` |
| `CRON_REINDEX` | Reindex/diagnostic job schedule | `0 4 * * *` |
| `CRON_METRICS` | Metrics rollup job schedule | `*/15 * * * *` |

Subsequent phases of the roadmap add service wiring, migrations, repositories, MCP tooling, and operational scripts atop this foundation.
