# DriftCore

DriftCore is a Drupal-aware MCP operations layer for real project context and guarded development workflows.

> Status: experimental. Production code is currently in `packages/server`.

## What DriftCore does today

DriftCore runs alongside a local or containerized Drupal codebase and provides:

- A `project_manifest` resource with Drupal root, core version, Composer summary, and custom module/theme discovery.
- Drush inspection tools:
  - `drift.drush_status`
  - `drift.drush_pml`
- Composer inspection tools:
  - `drift.composer_info`
  - `drift.composer_outdated`
- Two transports:
  - HTTP (GET read routes, POST write apply routes)
  - STDIO (line-delimited JSON actions)
- A shared response envelope for resources and tools:
  - `status: "ok" | "degraded" | "error" | "timeout" | "not_configured"`
  - optional `data`
  - optional `error`

## What DriftCore is not

To avoid ambiguity:

- It is **not** a multi-agent platform.
- It is **not** a sandbox execution engine.
- It is **not** an SDK generator.
- It is **not** a Drupal content-management MCP endpoint running inside Drupal.

The following modules/packages currently exist as placeholders or templates and should not be treated as implemented production features:

- `packages/server/src/features/sandboxExecution.ts` → `executeInSandbox` (stub)
- `packages/server/src/features/sdkGeneration.ts` → `generateSDK` (stub)
- `packages/server/src/features/schemaResources.ts` (static template resources)
- `packages/agent-runner` (placeholder package)

Milestone 7 records the current disposition for the speculative pieces in `docs/decisions/runner-sandbox-sdk.md`: the runner, sandbox, and SDK generator are deferred, not active product work.

## Quick start

From repo root:

1. Install dependencies

   `npm --prefix packages/server install`

2. Build

   `npm --prefix packages/server run build`

3. Provide config (either):
   - `DRIFTCORE_CONFIG=/abs/path/to/driftcore.config.json`
   - or `driftcore.config.json` in the current working directory

   Minimal config example:

   {
     "drupalRoot": "/abs/path/to/drupal/web"
   }

4. Start transport

   - STDIO: `npm --prefix packages/server run start:stdio`
   - HTTP: `npm --prefix packages/server run start:http -- --port 8080`

## Public HTTP routes (GET)

- `/health`
- `/resources`
- `/tools`
- `/project-manifest`
- `/drush/status`
- `/drush/pml`
- `/composer/info`
- `/composer/outdated`

## STDIO actions

- `resources`
- `tools`
- `project_manifest`
- `drush_status`
- `drush_pml`
- `composer_info`
- `composer_outdated`

## Available resources and tools

### Resources

- `project_manifest` — discovered project summary from local filesystem and Composer metadata.
- `schema.entityTypes` — static template schema data.
- `config.exported` — static template configuration sample.

### Tools

- `drift.drush_status` — wraps `drush status --format=json`.
- `drift.drush_pml` — wraps `drush pm:list --format=json`.
- `drift.composer_info` — reads `composer.json` and `composer.lock`.
- `drift.composer_outdated` — wraps `composer outdated --format=json`.

## Contract documentation

The versioned response and compatibility contract is documented in:

- `packages/server/docs/CONTRACT.md`

## Architecture summary

`
packages/server/src/
├── index.ts             # createMCPServer — wires config, tools, resources, transports
├── config.ts            # loadServerConfig — path resolution, validation, defaults
├── types.ts             # Shared types, response envelope, status taxonomy
├── bin/
│   ├── http.ts          # CLI entry point (yargs --port)
│   └── stdio.ts         # CLI entry point
├── transports/
│   ├── http.ts          # GET read routes and POST write apply routes
│   └── stdio.ts         # Line-delimited JSON action dispatch
├── features/
│   ├── cache.ts         # TimedCache<T> — in-memory TTL cache
│   ├── composerTools.ts # composer_info, composer_outdated handlers
│   ├── drushTools.ts    # drush_status, drush_pml handlers
│   ├── errorMapping.ts  # mapCliResultToError, truncateStderr
│   ├── projectManifest.ts # project_manifest resource builder
│   ├── projectPaths.ts  # resolveProjectRoot, readJsonFile, toProjectRelativePath
│   ├── sandboxExecution.ts # runCliCommand (real), executeInSandbox (stub)
│   ├── schemaResources.ts  # static template resources
│   └── sdkGeneration.ts    # stub
├── __tests__/           # node:test suites
└── integration/
    └── smoke.ts         # HTTP smoke test
`

## Roadmap (planned, not yet implemented)

- Stabilize and version all public response contracts with broader contract tests.
- Security hardening (auth/localhost enforcement, redaction, rate limiting).
- Replace static template schema resources with discovered project facts.
- Add workflow primitives with inspect → plan → preview → apply → verify.

## License

MIT
