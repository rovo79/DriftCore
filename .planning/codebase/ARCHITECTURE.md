# Architecture

**Analysis Date:** 2026-02-12

## Pattern Overview

**Overall:** Single-process, configuration-driven "MCP-style" server with two transports (HTTP + STDIO) exposing read-only resources and tools.

**Key Characteristics:**
- Transport adapters map requests/actions to feature functions.
- Feature functions return a shared response envelope (`status`, optional `data`, optional `error`).
- External CLI calls are allowlisted by construction (fixed commands/args in code).
- Subprocess execution is concurrency-limited and timeout-bounded.

## Layers

**Entry Points (Binaries):**
- Purpose: Start the server in a transport mode.
- Contains: CLI parsing and transport startup.
- Examples:
  - `packages/server/src/bin/http.ts`
  - `packages/server/src/bin/stdio.ts`
- Depends on: Server composition root.

**Server Composition Root:**
- Purpose: Build `ServerState` (resources, tools, config, logger) and expose transport handlers.
- Contains: config loading + defaults, operation logging wrapper, tool/resource registration.
- Location: `packages/server/src/index.ts`
- Depends on: `packages/server/src/config.ts`, `packages/server/src/features/*`, `packages/server/src/transports/*`, `packages/server/src/types.ts`

**Transport Layer:**
- Purpose: Adapt HTTP requests / STDIO lines to internal operations.
- Contains:
  - HTTP GET routing and JSON responses: `packages/server/src/transports/http.ts`
  - JSON-line input parsing + action routing: `packages/server/src/transports/stdio.ts`
- Depends on: Feature layer functions.

**Feature Layer (Domain Logic):**
- Purpose: Implement project manifest and CLI-backed tools.
- Contains:
  - Drupal project manifest: `packages/server/src/features/projectManifest.ts`
  - Drush tools + normalization: `packages/server/src/features/drushTools.ts`
  - Composer tools + normalization: `packages/server/src/features/composerTools.ts`
  - Static schema resources: `packages/server/src/features/schemaResources.ts`
- Depends on: Infra/utilities for file paths, subprocess execution, caching, error mapping.

**Infra / Utilities:**
- Purpose: Shared helpers and safety mechanisms.
- Contains:
  - Config loader/validator/defaults: `packages/server/src/config.ts`
  - CLI execution (spawn, timeout, max parallel): `packages/server/src/features/sandboxExecution.ts`
  - Error mapping and stderr truncation: `packages/server/src/features/errorMapping.ts`
  - TTL cache: `packages/server/src/features/cache.ts`
  - Project root resolution + JSON reads: `packages/server/src/features/projectPaths.ts`
- Depends on: Node standard library.

## Data Flow

**HTTP Request Flow:**
1. User starts HTTP binary: `packages/server/src/bin/http.ts`.
2. `createMCPServer()` loads config and builds `ServerState` - `packages/server/src/index.ts`.
3. `httpTransport()` matches `req.url` and routes to operation - `packages/server/src/transports/http.ts`.
4. Operation runs via `state.runOperation()` wrapper (timing/status logs) - `packages/server/src/index.ts`.
5. Feature returns `ResourceOrToolResponse<T>`.
6. Transport serializes JSON to the response - `packages/server/src/transports/http.ts`.

**STDIO Request Flow:**
1. User starts STDIO binary: `packages/server/src/bin/stdio.ts`.
2. `stdioTransport()` reads newline-delimited JSON objects - `packages/server/src/transports/stdio.ts`.
3. Transport switches on `request.action` and routes to feature.
4. Feature returns `ResourceOrToolResponse<T>`.
5. Transport writes JSON line response with `{ id, action, response }` - `packages/server/src/transports/stdio.ts`.

**State Management:**
- Mostly stateless per request.
- In-memory TTL cache for `drift.drush_pml` - `packages/server/src/features/drushTools.ts`.
- Subprocess concurrency queue is module-global within the Node process - `packages/server/src/features/sandboxExecution.ts`.

## Key Abstractions

**ServerState:**
- Purpose: Shared runtime context (resources/tools/config/logger).
- Location: `packages/server/src/types.ts`.

**ResourceOrToolResponse<T>:**
- Purpose: Shared response envelope (`status`, optional `data`, optional `error`).
- Status values: `ok`, `degraded`, `error`, `timeout`, `not_configured` - `packages/server/src/types.ts`.

**CLI Runner:**
- Purpose: Run allowlisted CLIs with timeout and concurrency controls.
- Location: `packages/server/src/features/sandboxExecution.ts`.

## Entry Points

**HTTP binary:**
- Location: `packages/server/src/bin/http.ts`
- Triggers: `npm run start:http --prefix packages/server -- --port 8080` (script defined in `packages/server/package.json`)

**STDIO binary:**
- Location: `packages/server/src/bin/stdio.ts`
- Triggers: `npm run start:stdio --prefix packages/server` (script defined in `packages/server/package.json`)

**Library entry:**
- Location: `packages/server/src/index.ts`
- Triggers: Imported by binaries and integration tests.

## Error Handling

**Strategy:**
- Return structured error payloads for expected failures (config missing, CLI failures, JSON parse errors).
- Transport-level exceptions are caught and returned as `E_TRANSPORT_FAILURE` (HTTP and STDIO).

**Patterns:**
- Config errors are returned as `not_configured` with error detail - `packages/server/src/config.ts`, used by feature layers.
- CLI failures normalized via `mapCliResultToError()` - `packages/server/src/features/errorMapping.ts`.
- stderr is truncated before returning - `packages/server/src/features/errorMapping.ts`.

## Cross-Cutting Concerns

**Logging:**
- Per-operation timing logs: `packages/server/src/index.ts`.
- Transport request logging: `packages/server/src/transports/http.ts`.

**Validation:**
- Config validation (drupalRoot existence and type) - `packages/server/src/config.ts`.
- CLI JSON parsing with defensive trimming - `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`.

---

*Architecture analysis: 2026-02-12*
*Update when major patterns change*
