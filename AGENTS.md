# AGENTS Guide for DriftCore

This file is the authoritative guide for coding agents working in this repo.

## What DriftCore Is

DriftCore is a **single-project, Drupal-aware MCP service** that runs alongside a local
or containerized Drupal codebase. It gives AI clients structured, low-risk access to
project context and selected developer workflows.

**Product now:** trusted local Drupal operations/context layer for AI.
**Product later:** higher-level workflow engine built on top.
**Not yet:** platform ecosystem with runner, sandbox, SDKs, or broad remote deployment.

## What Is Real Today

The only production code is in `packages/server`. It provides:

- **Project manifest** — Drupal root, core version, composer metadata, custom module/theme dirs
- **Drush inspection tools** — `drift.drush_status`, `drift.drush_pml`
- **Composer inspection tools** — `drift.composer_info`, `drift.composer_outdated`
- **HTTP and STDIO transports** — GET read routes, POST write apply routes, line-delimited JSON STDIO
- **Structured response envelope** — `status` (`ok|degraded|error|timeout|not_configured`), optional `data`, optional `error`
- **CLI execution wrapper** — `runCliCommand` with `shell: false`, timeouts, concurrency cap

### Explicitly Not Real Yet

These exist as stubs or placeholders. Do not treat them as working:

| Module | Status |
|---|---|
| `sandboxExecution.ts` → `executeInSandbox` | Placeholder. `runCliCommand` is real. |
| `sdkGeneration.ts` → `generateSDK` | No-op stub. |
| `schemaResources.ts` | Static template data, not dynamically introspected. |
| `packages/agent-runner` | Placeholder package. Not production code. |

Do not build on, extend, or reference these as if they work.

Milestone 7 records the current disposition in `docs/decisions/runner-sandbox-sdk.md`: the runner, sandbox, and SDK remain deferred and should stay out of production planning unless that decision is revisited.

## Active Scope

- Focus all implementation work on `packages/server` unless explicitly asked otherwise.
- `packages/agent-runner` is deferred. Do not let it steer architecture.

## Engineering Priorities (current)

These are ordered. Do not skip ahead.

1. **Contract and truth** — stabilize response schemas, version `project_manifest`, add contract tests, align docs with implementation reality.
2. **Security hardening** — HTTP auth or localhost-only enforcement, stderr/path redaction mode, binary path validation, rate limiting.
3. **Dynamic truth** — replace static schema resources with project-discovered facts, add capability metadata so clients know what's real vs template.
4. **Workflow primitives** — upgrade assessment, config drift analysis, scaffold planning. Every write-capable workflow follows: inspect → plan → preview → apply → verify.
5. **Operational maturity** — contract-level tests, malformed CLI resilience, timeout/process cleanup, CI gates.

## Tooling Baseline

- Runtime: Node.js 20+
- Language: TypeScript (strict mode enabled)
- Module system: ESM (`"type": "module"`)
- Tests: Node built-in test runner (`node:test` + `node --test`)
- Build output: `packages/server/dist`

## Working Directory Conventions

- Run server package commands from `packages/server`.
- Use `--prefix` when running from repo root.
- Prefer reproducible CLI commands over IDE-only actions.

## Install

```sh
npm --prefix packages/server install
```

## Build, Lint, Test

```sh
# Build TypeScript
npm --prefix packages/server run build

# Lint / typecheck (tsc --noEmit)
npm --prefix packages/server run lint

# Full test suite (builds first, then runs node --test dist/__tests__)
npm --prefix packages/server test

# Integration smoke test
npm --prefix packages/server run integration
```

### Run a Single Test

Tests execute from `dist`, so build first.

```sh
# Build
npm --prefix packages/server run build

# One file
node --test packages/server/dist/__tests__/projectManifest.test.js

# One test by name
node --test --test-name-pattern "degrades when composer metadata is incomplete" \
  packages/server/dist/__tests__/projectManifest.test.js

# From package directory
cd packages/server && node --test dist/__tests__/projectManifest.test.js
```

## Start

```sh
# STDIO transport
npm --prefix packages/server run start:stdio

# HTTP transport
npm --prefix packages/server run start:http -- --port 8080

# With explicit config
DRIFTCORE_CONFIG=/abs/path/to/driftcore.config.json npm --prefix packages/server run start:stdio
```

## Pre-PR Verification

Run in this order for any `packages/server` change:

```sh
npm --prefix packages/server run lint
npm --prefix packages/server run build
npm --prefix packages/server test
npm --prefix packages/server run integration  # for transport/tooling changes
```

## Architecture Quick Reference

```
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
│   ├── schemaResources.ts  # static template resources (demote, don't extend)
│   └── sdkGeneration.ts    # stub (deferred)
├── __tests__/           # node:test suites
└── integration/
    └── smoke.ts         # HTTP smoke test (shape checks, not deep validation)
```

### Key design rules

- Transport handlers are thin dispatchers. Business logic belongs in `features/*`.
- All responses use the shared envelope: `{ status, data?, error? }`.
- CLI tools use a fixed allowlist — no arbitrary user flags or shell access.
- Config resolution: explicit path → `DRIFTCORE_CONFIG` env → `./driftcore.config.json`.

## Code Style and Conventions

### Formatting
- 2-space indentation.
- Semicolons required.
- Double quotes in TypeScript files.
- Keep lines readable; extract a helper when nesting obscures intent.

### Imports
- Order: Node built-ins (`node:*`) → external packages → internal relative imports.
- Use explicit `.js` extension in TS import paths (ESM emit compatibility).
- Use `import type` for type-only imports.

### Types and API Shapes
- Explicit interfaces/types for response payloads.
- Shared envelope: `status`, optional `data`, optional `error`.
- No `any`. Validate and coerce `unknown` data deliberately.
- Preserve strict-null behavior (`string | null` where applicable).

### Naming
- `PascalCase`: interfaces, types.
- `camelCase`: variables, functions, parameters.
- Descriptive tool handler names (`runDrushStatus`, `runComposerOutdated`).
- Stable error code constants (`E_JSON_PARSE`, `E_CONFIG_INVALID_ROOT`).

### Error Handling
- Never swallow errors silently.
- Return structured error responses via `makeErrorResponse`, not ad-hoc strings.
- Include diagnostics that help debugging; do not leak secrets or full paths in non-redacted mode.
- Route CLI failures through `mapCliResultToError` when available.

### Filesystem and Path Safety
- Resolve and validate paths before use.
- Use `projectPaths` helpers for project-relative normalization.
- Do not assume binary paths; rely on config resolution logic.

### Caching and Timeouts
- Respect configured TTLs and timeout values.
- Defaults are centralized in `config.ts` (`applyDefaults`).
- No hidden global mutable state outside `cache.ts`.

## Contract Stability

This is a first-class concern. When modifying tool or resource responses:

- Do not rename or remove fields in response payloads without explicit instruction.
- Do not change the `status` taxonomy (`ok|degraded|error|timeout|not_configured`).
- Do not change error code constants (`E_*`).
- New fields are additive and safe. Removing or renaming is a breaking change.
- When adding tools or resources, follow the existing registration pattern in `index.ts`.

## Changelog Policy

Every pull request that changes a response shape, error code, HTTP route, or STDIO action must add or update `CHANGELOG.md`. Contract-affecting entries belong in a `Contract Changes` subsection with a short before/after description so reviewers can see exactly what changed without diffing the implementation.

## Security Awareness

Current known gaps (these are active priorities, not footnotes):

- HTTP transport has **no auth**. Treat it as localhost-only until auth is added.
- Error payloads may leak filesystem paths via stderr. Redaction mode is planned.
- No rate limiting on HTTP endpoints.
- Binary paths (drush, composer) are resolved but not allowlist-validated.
- `spawn` uses `shell: false` and timeouts — preserve these invariants.

When working on security-adjacent code:
- Never introduce `shell: true` in subprocess execution.
- Never pass unvalidated user input to CLI arguments.
- Never expose raw stderr in responses without truncation (`truncateStderr`).
- Preserve the concurrency cap (`maxParallelCli`).

## Test Conventions

- Use `node:test` (`describe`, `it`) and `node:assert/strict`.
- Build small temp project fixtures for integration-like unit tests.
- Assert `status` codes and exact key fields for tool/resource responses.
- Cover success, degraded, and error paths.
- Non-write tests (`cliTools.nonwrite.test.ts`) verify tools don't mutate the fixture.

## Agent Behavior Expectations

- Before changing behavior, read the relevant feature module and its test file.
- Reuse existing helpers (`errorMapping`, `projectPaths`, `cache`) before adding new abstractions.
- Keep transport handlers thin. If you're adding logic to a transport, it probably belongs in `features/*`.
- Keep public response contracts backward-compatible unless explicitly requested to break them.
- When adding a tool, register it via the existing factory pattern (`getDrushTools`, `getComposerTools`).
- Do not build on stubbed modules (`executeInSandbox`, `generateSDK`) unless the task explicitly says to implement them.

## Workflow Primitive Pattern (for future reference)

When implementing workflow tools (upgrade assessment, config drift, scaffolding), follow this pattern:

1. **Inspect** — read-only data gathering, return structured state
2. **Plan** — produce a structured change plan from inspected state
3. **Preview** — dry-run or diff showing what would change
4. **Apply** — execute the change with bounded scope
5. **Verify** — post-operation check confirming the result

No mutation endpoint should skip preview and verification.

## Quick Command Reference

| Action | Command |
|---|---|
| Build | `npm --prefix packages/server run build` |
| Lint | `npm --prefix packages/server run lint` |
| Test all | `npm --prefix packages/server test` |
| Test one file | `node --test packages/server/dist/__tests__/cliTools.test.js` |
| Test one case | `node --test --test-name-pattern "normalizes drush status output" packages/server/dist/__tests__/cliTools.test.js` |
| Integration | `npm --prefix packages/server run integration` |
