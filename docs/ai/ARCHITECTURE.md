# Architecture

DriftCore is a single-process local server. Its standard MCP STDIO adapter exposes four connected-project resources and sixteen tools. The `driftcore` executable at `packages/server/src/bin/mcp.ts` starts the official MCP SDK v1.29.0 server and communicates with a client over stdin/stdout. Operational logs use stderr.

## Composition and request flow

1. The MCP entry point parses `--project-root` and `--config`, then creates transport-independent state through `serverState.ts`.
2. Configuration selection follows CLI project root, explicit config, `DRIFTCORE_CONFIG`, CWD config, then upward discovery. `config.ts` validates and applies defaults; `projectRoot.ts` resolves a conventional Drupal layout.
3. `mcp/server.ts` registers resources and tools. The handlers call existing functions in `features/*` through `state.runOperation` for status/timing logging.
4. Domain functions return the shared `status`, optional `data`, optional `error` envelope from `types.ts`. `mcp/resultAdapter.ts` encodes tool results for MCP without changing that envelope.
5. Drush and Composer commands are fixed and executed without a shell, with timeouts and a concurrency limit. Guarded writes use preview tokens and post-apply verification.

Resources: `mcp/resources.ts`. Read-only tools: `mcp/readTools.ts`. Guarded preview/apply/verify tools: `mcp/writeTools.ts`. Strict Zod inputs: `mcp/toolSchemas.ts`. The connected-project manifest's schema version is `0.2.0`.

## Transport boundaries

| Surface | Entry point | Dispatch | Protocol |
| --- | --- | --- | --- |
| Standard MCP STDIO | `bin/mcp.ts` | `mcp/server.ts` | MCP SDK messages |
| Legacy REST API | `bin/http.ts` | `transports/http.ts` | Route-per-operation HTTP |
| Legacy DriftCore action-STDIO | `bin/legacyStdio.ts` | `transports/legacyStdio.ts` | One custom JSON action per line |

`createMCPServer()` in `index.ts` remains the legacy composition API. The legacy adapters reuse the domain state and operations. The REST routes do not implement Streamable HTTP MCP and have no `/mcp` endpoint. The custom action protocol is not MCP STDIO.

## Boundaries and deferred work

The process has no persistent job store or distributed components. `features/sdkGeneration.ts` and `executeInSandbox` are placeholders. A separate runner, general sandbox, generated SDK, DDEV/Lando backends, and Streamable HTTP are deferred. See [the decision](../decisions/standard-mcp-stdio.md) and the [server contract](../../packages/server/docs/CONTRACT.md).
