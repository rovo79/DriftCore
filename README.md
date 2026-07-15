# DriftCore

> A Drupal project operations server for AI coding and maintenance agents.

DriftCore gives AI agents structured, authoritative context about a Drupal codebase and guarded access to Drupal engineering workflows through the Model Context Protocol.

It runs alongside a local or containerized Drupal project and helps agents inspect and safely operate on the system using Drupal-aware filesystem discovery, Drush, Composer, and explicit workflow controls.

DriftCore operates on the **project and engineering plane**:

* understanding the Drupal project
* inspecting modules, themes, configuration, and dependencies
* diagnosing development and runtime conditions
* planning and previewing changes
* applying approved operations
* verifying the resulting state

It does not expose Drupal’s production content as an agent-facing CMS API. Content entities, media, taxonomy, and editorial workflows belong to a separate **content plane**, ideally implemented through Drupal’s own authentication, permissions, and entity APIs.

```text
Content and business agents
          ↓
Drupal content MCP
          ↓
Entities, media, taxonomy, editorial workflows


Coding and maintenance agents
          ↓
DriftCore
          ↓
Project context, Drush, Composer, and guarded operations
```

These approaches are complementary. A Drupal installation could use a content-facing MCP integration for agents working with the site’s information while using DriftCore for agents working on the Drupal system itself.

> Status: Experimental. Production code is currently located in `packages/server`.

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

## Current boundaries

DriftCore is intentionally focused on Drupal project operations.

It is not currently:

- a content-management MCP endpoint
- a multi-agent orchestration platform
- a general-purpose sandbox
- an SDK generator
- a replacement for Drupal authentication or entity access control

Placeholder and deferred packages are documented below and should not be interpreted as implemented product capabilities.

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
