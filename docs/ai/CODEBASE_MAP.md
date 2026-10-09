# Codebase map

The implemented runtime is `packages/server`, a TypeScript Node.js package for a single local Drupal project. Its primary external interface is Standard MCP STDIO. It exposes four connected-project resources, seven read-only tools, and nine guarded preview/apply/verify tools. Legacy REST and custom action-STDIO adapters remain for compatibility.

## Entry points and composition

| File | Role |
| --- | --- |
| `packages/server/src/bin/mcp.ts` | `driftcore` MCP executable, CLI and SDK STDIO transport |
| `packages/server/src/mcp/server.ts` | Register four resources and sixteen tools |
| `packages/server/src/serverState.ts` | Config, binaries, catalogs and operation logging shared by adapters |
| `packages/server/src/bin/http.ts` | Legacy REST entry point and host/port arguments |
| `packages/server/src/bin/legacyStdio.ts` | Legacy action-STDIO entry point |
| `packages/server/src/index.ts` | `createMCPServer()` compatibility API for legacy adapters |

`src/config.ts` validates config and defaults; `src/projectRoot.ts` handles consumer discovery and conventional Drupal roots. `src/types.ts` defines shared response envelopes. The manifest schema version is `0.2.0`.

## Where to change behavior

- Standard MCP resource names and mappings: `src/mcp/resources.ts`.
- Standard MCP tool names and mappings: `src/mcp/readTools.ts` and `src/mcp/writeTools.ts`.
- Strict input schemas: `src/mcp/toolSchemas.ts`; result adaptation: `src/mcp/resultAdapter.ts`.
- Legacy REST routes: `src/transports/http.ts`.
- Legacy JSON action dispatch: `src/transports/legacyStdio.ts`.
- Drupal project discovery and facts: `src/features/projectManifest.ts`, `projectModules.ts`, `projectConfigLayout.ts`, `projectChecks.ts`, `projectTruth.ts` and `projectPaths.ts`.
- Drush and Composer adapters: `src/features/drushTools.ts`, `composerTools.ts`.
- Guarded write workflows: `src/features/workflows/`.
- CLI execution, timeouts and concurrency: `src/features/sandboxExecution.ts`.

`schemaResources.ts` contains legacy static templates, not connected-project MCP resources. `sdkGeneration.ts` and `executeInSandbox` are stubs. `packages/agent-runner` is deferred.

## Verification and supporting files

Tests live in `packages/server/src/__tests__`. Legacy HTTP smoke is `src/integration/smoke.ts`. Packed-tarball SDK consumer proof is `src/integration/packedMcpSmoke.ts`. The package Dockerfile still launches Legacy REST. `.github/workflows/ci.yml` runs lint, build and unit tests on Node 20. The root README documents installation and the full public MCP surface.
