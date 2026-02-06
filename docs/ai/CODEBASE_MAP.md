# CODEBASE_MAP

- **What this repo is**
  - DriftCore is currently an experimental MCP server focused on giving agents read-only, structured insight into a single Drupal project (project manifest + Drush/Composer inspection tools).
  - The implementation that exists in this repository is centered in `packages/server`.
- **Top-level layout**
  - `packages/server/`: TypeScript Node.js server package (runtime code, tests, Dockerfile, package scripts).
  - `rfcs/`: product/architecture RFCs (not runtime code).
  - `specs/`: product specs and acceptance criteria documents.
  - `README.md`: project-level positioning and roadmap.

## Main runtime entrypoints

- **HTTP binary entrypoint**: `packages/server/src/bin/http.ts`
  - Parses `--port` with `yargs`, creates server, starts HTTP transport.
- **STDIO binary entrypoint**: `packages/server/src/bin/stdio.ts`
  - Creates server and starts STDIO transport.
- **Server composition root**: `packages/server/src/index.ts`
  - Loads config, registers resources/tools, wraps operations with logging, exposes `handleHttp` and `handleStdio`.

## Organization inside `packages/server/src`

- `bin/`: executable CLIs (`http.ts`, `stdio.ts`).
- `transports/`: protocol adapters
  - `http.ts`: GET routes (`/health`, `/resources`, `/tools`, `/project-manifest`, `/drush/*`, `/composer/*`).
  - `stdio.ts`: JSON line actions (`resources`, `tools`, `project_manifest`, etc.).
- `features/`: business logic
  - `projectManifest.ts`: builds `project_manifest` resource payload.
  - `drushTools.ts`: `drift.drush_status`, `drift.drush_pml` execution + normalization.
  - `composerTools.ts`: `drift.composer_info`, `drift.composer_outdated`.
  - `config.ts`: config loading/defaulting/validation.
  - `sandboxExecution.ts`: CLI process runner and concurrency controls.
  - `errorMapping.ts`, `cache.ts`, `projectPaths.ts`, `schemaResources.ts`, `sdkGeneration.ts` (stub).
- `__tests__/`: node test suites for manifest parsing, tool parsing, schema/tool registration, non-write guarantees.
- `integration/smoke.ts`: HTTP smoke test.

## Where to make changes

- **Routing / external API surface**
  - HTTP routes: `packages/server/src/transports/http.ts`
  - STDIO actions: `packages/server/src/transports/stdio.ts`
  - Tool/resource registration list: `packages/server/src/index.ts`
- **Data models / response shapes / contracts**
  - Shared types and response envelopes: `packages/server/src/types.ts`
  - Resource schema payload template: `packages/server/src/features/schemaResources.ts`
- **Domain logic**
  - Drupal manifest discovery: `packages/server/src/features/projectManifest.ts`
  - Drush adapters: `packages/server/src/features/drushTools.ts`
  - Composer adapters: `packages/server/src/features/composerTools.ts`
- **Infra/runtime execution**
  - Config handling/defaults/validation: `packages/server/src/config.ts`
  - Child process execution + timeout + parallelism: `packages/server/src/features/sandboxExecution.ts`
  - Container runtime packaging: `packages/server/Dockerfile`
- **Tests**
  - Unit tests for tool parsing/behavior: `packages/server/src/__tests__/cliTools.test.ts`
  - Non-write invariant: `packages/server/src/__tests__/cliTools.nonwrite.test.ts`
  - Manifest behavior: `packages/server/src/__tests__/projectManifest.test.ts`
  - Route-level smoke test: `packages/server/src/integration/smoke.ts`
- **UI**
  - No UI frontend code exists in the current tree; this repo currently exposes MCP over HTTP/STDIO only.

## Assumptions

- This map assumes only currently tracked files are in scope (no hidden submodules/worktrees).
- There is no CI workflow config checked in right now; if CI exists externally, that is not visible from this repository contents.
