# MemorizedMCP-TS

**Important:** This MCP server has only been validated end-to-end with **Cursor 2.0**. Other IDEs or MCP hosts might require additional wiring or configuration changes. Contributions that broaden compatibility are very welcome!

MemorizedMCP-TS is a Bun + TypeScript implementation of the Memorized MCP server. It provides:

- Hybrid memory infrastructure (SQLite + Vectra) with multi-layer support
- Document intelligence with chunking, embeddings, FTS-backed search, and entity extraction
- A knowledge graph service that links entities, relationships, and contextual metadata
- A fully sandboxed `run_code` experience plus a rich multi-tool registry for discrete MCP calls
- Operational tooling: migrations, scheduled jobs, backup/restore, schema generation, and analytics

Key architectural docs:
- [`docs/Architecture.md`](docs/Architecture.md) — overall topology and module layout
- [`docs/Data-Model.md`](docs/Data-Model.md) — database schema, embeddings, and KG storage
- [`docs/API.md`](docs/API.md) — tool definitions, schemas, and transport contracts
- [`docs/MCP-Server-Guide.md`](docs/MCP-Server-Guide.md) — in-depth usage guide (single vs multi tool)

---

## Installation

```sh
bun install
cp .env.example .env    # customise configuration if required
```

The server relies on Bun ≥ 1.3.0. Ensure the configured `TRANSFORMER_MODEL` is available locally or via the network, and create the `DATA_ROOT` directories if you plan to persist data.

### From npm (after publishing)

```sh
npm install memorizedmcp-ts
bunx memorizedmcp-ts --multi-tool   # launches the published stdio server
```

CLI flags:

| Flag | Description |
| ---- | ----------- |
| `--config <path>` | Load an alternate `.env` file before bootstrapping |
| `--multi-tool` | Force multi-tool registration (`MCP_MULTI_TOOL=true`) |
| `--single-tool` | Force single-tool sandbox (`MCP_MULTI_TOOL=false`) |
| `--env KEY=VALUE` | Inject arbitrary environment overrides (repeatable) |
| `--help` | Print CLI usage |

All options map to the same environment variables used in self-hosted mode, so you can switch between single-tool and multi-tool behaviour without editing source code.

---

## Quickstart

```sh
# Start in watch mode
bun run dev

# Or build + run the bundled output
bun run build
bun run start
```

Single-tool mode exposes a `run_code` tool with type-safe bindings:

```ts
const memory = await services.memory.addMemory({
  content: "User prefers dark mode",
  layer: "semantic",
  importance: 0.8,
});

const context = await services.knowledge.getEntityContext({
  entityId: "entity-id",
});
```

Toggle multi-tool mode by setting `MCP_MULTI_TOOL=true` (in `.env` or the process environment). The server will register every tool described in [`docs/MCP-Server-Guide.md`](docs/MCP-Server-Guide.md).

---

## Cursor MCP Configuration

The published package is compatible with Cursor’s install link generator [[Cursor MCP install links](https://cursor.com/docs/context/mcp/install-links#generate-install-link)]:

```jsonc
{
  "memorizedmcp-ts": {
    "command": "npx",
    "args": [
      "-y",
      "@perkyzz999/memorizedmcp-ts",
      "--",
      "--multi-tool"
    ],
    "env": {
      "LOG_LEVEL": "info",
      "TRANSFORMER_MODEL": "Xenova/all-MiniLM-L6-v2",
      "DATA_ROOT": "~/.memorizedmcp"
    }
  }
}
```

Switch between modes by replacing `--multi-tool` with `--single-tool`, or omit the flag to defer to `.env` defaults. Additional overrides can be provided via repeated `--env KEY=VALUE` arguments.

---

## Available Scripts

| Script | Description |
| ------ | ----------- |
| `bun run dev` | Execute the entrypoint with file watching |
| `bun run start` | Run the compiled bundle in `dist/` |
| `bun run build` | Bundle the server for distribution |
| `bun run build:types` | Emit declaration files into `dist/types/` |
| `bun run lint` | Static analysis via Biome |
| `bun run format` | Auto-format the codebase |
| `bun run test` | Execute Vitest suites |
| `bun run migrate` | Apply database migrations |
| `bun run generate-schemas` | Produce JSON Schemas from Zod definitions |
| `bun run backup` / `bun run restore -- <dir>` | Data snapshot + restore helpers |
| `bun run export:memories` / `import:memories` | JSONL import/export utilities |
| `npm run prepare-release` | Lint, test, build, emit declarations, regenerate schemas |

---

## Configuration

The server reads configuration from `.env` (via `dotenv`) plus runtime overrides. Important keys:

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `LOG_LEVEL` | Pino log level | `info` |
| `DATA_ROOT` | Root for SQLite, backups, vectra indices | `./data` |
| `SQLITE_URL` | Path to SQLite database | `./data/sqlite/memorized.db` |
| `TRANSFORMER_MODEL` | Transformers.js model ID | `hash` (replace with a real model) |
| `MCP_MULTI_TOOL` | Enable multi-tool registry | `false` |
| `SINGLE_TOOL_TIMEOUT_MS` | Sandbox timeout for `run_code` | `120000` |
| `CRON_*` | Cron expressions for scheduled jobs | see `.env.example` |

Refer to [`docs/Operations.md`](docs/Operations.md) for deployment and scheduling guidance.

---

## Publishing Workflow

Follow the steps in [`docs/MCP-Server-Guide.md`](docs/MCP-Server-Guide.md) and [`CHANGELOG.md`](CHANGELOG.md), then run:

```sh
npm run prepare-release
npm publish --access public --tag latest   # or beta/rc as appropriate
```

The `prepare-release` script executes linting, tests, bundling, type emission, and schema generation so the tarball includes everything required to run the MCP server.

---

## Security & Hardening Checklist

- `bun run test` before every release
- Review cron schedules (`CRON_*`) and sandbox timeout (`SINGLE_TOOL_TIMEOUT_MS`)
- Store backups in secure storage and restrict filesystem permissions to `DATA_ROOT`
- Use a vetted `TRANSFORMER_MODEL`; pre-warm embeddings if offline

---

## Compatibility Notes

- Fully tested with **Cursor 2.0** (MCP host + IDE)
- Other MCP clients may require modified transport wiring or additional glue code (`startMcpServer`, tool registration)
- Report compatibility issues through GitHub issues so we can broaden out-of-the-box support

---

## Contributing

1. Fork the repository and create a feature branch
2. Run `bun run lint` and `bun run test` before committing
3. Update documentation (README, MCP guide, CHANGELOG) as needed
4. Submit a PR describing how you tested the change (include IDE / MCP host details)

Thanks for using MemorizedMCP-TS! Complimentary feedback and feature requests are encouraged via GitHub issues or pull requests.
