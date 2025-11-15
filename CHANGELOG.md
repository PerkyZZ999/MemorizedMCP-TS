# Changelog

## [1.2.0] - 2025-11-15

### Changed
- Bump npm metadata and runtime banner defaults to `v1.2.0` so this branch can become the new `main` release without further functional changes.

## [1.1.3] - 2025-11-11

### Added
- Introduced `--path` (`-p`) CLI flag to override `DATA_ROOT`, making it easy to colocate SQLite/vectors within project workspaces.

### Changed
- Default banner fallback version now tracks `v1.1.3`.

## [1.1.0] - 2025-11-10

### Added
- Expanded knowledge graph service with entity CRUD, relation management, tagging, graph traversal, and contextual extraction utilities.
- Enriched memory service with retrieval helpers (`getMemory`, entity/document filters) and MCP multi-tool coverage.
- Extended document service to support update/delete, FTS-backed search, reference introspection, and analytics tooling.
- Published MCP multi-tool suite covering the new memory, document, and knowledge graph operations.
- Added release tooling (`bun run build`, declaration emission, schema generation) plus CLI shim for `bunx memorizedmcp-ts`.
- Introduced CLI flags (`--multi-tool`, `--single-tool`, `--config`, `--env`) and bin entry for seamless `npx -y memorizedmcp-ts` usage in Cursor install links.
- Documented the complete tool surface and single vs multi-tool behaviour in `docs/MCP-Server-Guide.md` and README.

### Changed
- `package.json` now exposes dual ESM entrypoints, type declarations, and a `prepare-release` workflow suited for npm publishing.
- README now highlights Cursor 2.0 compatibility, installation steps, and publishing guidance.

### Notes
- This version has been validated with Cursor 2.0; other MCP hosts may need additional testing or configuration.

## v1.0.0-beta (2025-11-07)

- Bootstrapped Bun + TypeScript server with configuration, logging, and SQLite/Vectra data layer.
- Implemented memory, document, knowledge graph, search, analytics, and system services with Zod schemas and tests.
- Added MCP stdio server exposing `run_code` sandbox plus multi-tool registry for memory, document, knowledge, and system actions.
- Introduced cron-based job scheduler, backup/restore utilities, JSONL import/export scripts, and benchmark harness.
- Documented setup/operations, provided schema generation pipeline, and added health checks, integration skeleton, and fallback embedding strategy.

