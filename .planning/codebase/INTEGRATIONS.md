# External Integrations

**Analysis Date:** 2026-02-12

## APIs & External Services

**MCP Clients (external to this repo):**
- DriftCore exposes two client interfaces:
  - HTTP GET API - `packages/server/src/transports/http.ts`
  - STDIO line-based JSON protocol - `packages/server/src/transports/stdio.ts`
- These are client-facing surfaces even though they run locally.

**External CLIs (invoked as subprocesses):**
- Drush - executed via `child_process.spawn()` in `packages/server/src/features/sandboxExecution.ts`
  - Resolution: configured `drushPath` or discovered `vendor/bin/drush` or fallback `drush` in PATH - `packages/server/src/features/drushTools.ts`
  - Commands:
    - `drush status --format=json` - `packages/server/src/features/drushTools.ts`
    - `drush pm:list --format=json` - `packages/server/src/features/drushTools.ts`
- Composer - executed via `child_process.spawn()` in `packages/server/src/features/sandboxExecution.ts`
  - Resolution: configured `composerPath` or discovered `vendor/bin/composer` / `composer.phar` / fallback `composer` - `packages/server/src/features/composerTools.ts`
  - Commands:
    - `composer outdated --format=json` - `packages/server/src/features/composerTools.ts`
  - Also reads composer files directly (no subprocess): `composer.json`, `composer.lock` - `packages/server/src/features/composerTools.ts`, `packages/server/src/features/projectManifest.ts`

## Data Storage

**Databases:**
- None (no persistent datastore in this repository).

**File Storage:**
- Reads files from the configured Drupal project root (external checkout on disk).
  - Project root resolution: `packages/server/src/features/projectPaths.ts`
  - Manifest discovery: `packages/server/src/features/projectManifest.ts`

**Caching:**
- In-memory TTL cache for `drift.drush_pml` results - `packages/server/src/features/drushTools.ts` uses `packages/server/src/features/cache.ts`

## Authentication & Identity

**HTTP transport:**
- No built-in authentication/authorization. Routes are available to any client that can connect to the server port - `packages/server/src/transports/http.ts`.

**STDIO transport:**
- No authentication; assumes trusted parent process piping JSON lines - `packages/server/src/transports/stdio.ts`.

## Monitoring & Observability

**Logs:**
- Console-based logging (default logger is `console`).
  - Per-operation timing/status logging wrapper: `packages/server/src/index.ts`
  - Transport logs requests/actions: `packages/server/src/transports/http.ts`, `packages/server/src/transports/stdio.ts`

## CI/CD & Deployment

**CI Pipeline:**
- GitHub Actions - `.github/workflows/ci.yml`
  - Installs and runs `build`, `lint`, `test`, `integration` for `packages/server` and placeholder `packages/agent-runner`.

**Containerization:**
- Docker image build for server package - `packages/server/Dockerfile`
  - Base image: `node:20-slim`
  - Build: `npm install && npm run build`
  - Default command: `node dist/bin/http.js`

## Environment Configuration

**Development:**
- Required env/config:
  - `DRIFTCORE_CONFIG` (recommended) - points to a JSON config file - `packages/server/src/config.ts`, `packages/server/README.md`
- Config file fields (non-exhaustive; see docs/examples):
  - `drupalRoot` (required) - validated directory - `packages/server/src/config.ts`
  - `drushPath`, `composerPath` (optional)
  - `customModuleDirs`, `customThemeDirs` (optional; defaults applied) - `packages/server/src/config.ts`
  - `timeouts`, `maxParallelCli`, `cacheTtlMs` (optional)

**Production:**
- Same config model as development.
- Consider how configured paths map inside container/host when using Docker - `packages/server/Dockerfile`.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2026-02-12*
*Update when adding/removing external services*
