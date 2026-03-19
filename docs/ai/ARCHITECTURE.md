# ARCHITECTURE

- **High-level shape**
  - A single-process MCP-style server composed of:
    - transport layer (`http`, `stdio`)
    - feature layer (project manifest + Drush/Composer adapters)
    - infrastructure helpers (config loader, CLI runner, error mapping/cache/path helpers)
  - Configuration-driven: server behavior depends on `drupalRoot` and optional binary paths/timeouts.

## Request/operation flow

- Startup:
  - Entrypoint (`src/bin/http.ts` or `src/bin/stdio.ts`) calls `createMCPServer()`.
  - `createMCPServer()` loads config and initializes `ServerState` with resources + tools.
- Invocation:
  - Transport maps a route/action to a feature function.
  - Each call is wrapped in `runOperation` for timing/status logging.
  - Feature either returns `ok` data or structured failure/degraded/not_configured responses.

## Component boundaries

- **Transport layer**
  - `src/transports/http.ts`: read-only GET API routing.
  - `src/transports/stdio.ts`: read-only action switch over JSON lines.
- **Feature layer**
  - `projectManifest.ts`: filesystem/composer inspection and module/theme discovery.
  - `drushTools.ts`: Drush command execution, output parsing, module/theme type normalization.
  - `composerTools.ts`: Composer file inspection and outdated package parsing/type tagging.
- **Infra/utilities**
  - `config.ts`: defaults + input validation + error codes.
  - `sandboxExecution.ts`: process execution (spawn), timeout kill, max parallel queue.
  - `errorMapping.ts`: standardized CLI failure mapping.
  - `cache.ts`: in-memory TTL cache used by `drush_pml`.
  - `projectPaths.ts`: project root resolution and JSON file reads.

## Data contracts

- Shared response envelope and status model (`ok`, `degraded`, `error`, `timeout`, `not_configured`) live in `src/types.ts`.
- Versioned contract reference: `packages/server/docs/CONTRACT.md`.
- Tool/resource descriptors are static objects exposed via `/tools` and `/resources`.
- `project_manifest` schema version currently hardcoded to `0.1.0`.

## Notable architectural constraints

- Tool commands are fixed/allowlisted in code (no user-provided CLI flags through transport interfaces).
- Command execution defaults to serialized mode (`maxParallelCli` defaults to `1`).
- HTTP API uses GET for read routes and POST only for write apply routes; it does not implement auth, sessions, or protocol-level MCP envelopes.
- `features/sdkGeneration.ts` and sandbox code execution are placeholders (not production behavior yet).

## Assumptions

- Architecture description reflects current implementation, not full roadmap/RFC target state.
- No distributed components or persistent stores are present in the checked-in runtime package.
