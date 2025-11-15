# Changelog

## [1.1.9] - 2025-11-14

### Fixed
- Disable stdin-based shutdown monitoring by default and make it opt-in via `MCP_ENABLE_STDIN_SHUTDOWN`, preventing the CLI/npx workflow from exiting immediately in Cursor 2.0.
- Parent PID watchdog now auto-enables whenever `MEMORIZEDMCP_PARENT_PID` is provided, keeping the anti-zombie protection without impacting manual runs.
- Document the new shutdown toggles in `README.md` and `docs/MCP-Server-Guide.md`.

### Changed
- Bump npm package metadata to `v1.1.9`.

## [1.1.8] - 2025-11-11

### Changed
- Bump npm package metadata to `v1.1.8` to capture the latest shutdown behaviour adjustments.

## [1.1.7] - 2025-11-11

### Changed
- Bump npm package metadata to `v1.1.7` to publish the latest shutdown hardening fixes.

## [1.1.6] - 2025-11-11

### Fixed
- Close the MCP stdio transport and stop scheduled jobs when the client disconnects, ensuring the server exits cleanly instead of lingering in the background.
- Harden the npm bin shim to propagate termination signals and kill the Bun subprocess on Windows, preventing orphaned `bun.exe` processes.
- Ensure the CLI wrapper watches for stdin closure/errors so disabling the MCP server tears down the Bun subprocess immediately.
- Detect closed stdio streams (e.g. when an MCP host disables the server) and trigger shutdown immediately.
- Introduce a parent PID heartbeat watchdog so child Bun workers exit if the Cursor parent terminates without sending signals.
- Skip stdin monitoring when attached to an interactive TTY so manual `bun run` sessions stay alive while Cursor pipes still trigger shutdown.

### Changed
- Default banner and tool metadata now fall back to `v1.1.6`.

## [1.1.5] - 2025-11-11

### Fixed
- Close the MCP stdio transport and stop scheduled jobs when the client disconnects, ensuring the server exits cleanly instead of lingering in the background.
- Harden the npm bin shim to propagate termination signals and kill the Bun subprocess on Windows, preventing orphaned `bun.exe` processes.
- Detect closed stdio streams (e.g. when an MCP host disables the server) and trigger shutdown immediately.

### Changed
- Default banner and tool metadata now fall back to `v1.1.5`.

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

