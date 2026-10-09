# Standard MCP STDIO and legacy transport compatibility

## Decision

The primary local interface is the `driftcore` executable using standard MCP
STDIO and the official TypeScript SDK, pinned to version `1.29.0`. The client
launches the server and owns its process lifecycle. Standard MCP stdout is
reserved for protocol messages; operational logs and startup diagnostics go to
stderr.

Domain services remain transport-independent. Resources and tools delegate to
the existing project inspection, Drush, Composer, and guarded workflow functions.
Preview tokens, apply boundaries, response envelopes, and verification semantics
remain unchanged.

The old route-per-operation REST HTTP interface and line-delimited action-STDIO
interface remain temporary legacy adapters. Neither implements standard MCP HTTP
or standard MCP STDIO. `createMCPServer().handleHttp()` and `.handleStdio()` retain
their existing compatibility behavior; the standard server uses its separate MCP
entry point.

## Commands and source naming

- `driftcore`, `start`, and `start:mcp` select standard MCP STDIO.
- `start:stdio:legacy` selects `dist/bin/legacyStdio.js`, using the custom
  `{"id":1,"action":"project_manifest"}` protocol.
- `start:http:legacy` selects `dist/bin/http.js`, using the existing REST routes.
- The custom STDIO dispatcher lives in `src/transports/legacyStdio.ts`.
- The ambiguous `start:stdio` and `start:http` script names are removed. Existing
  callers must use the explicitly named legacy scripts for compatibility.

Legacy adapters retain config-file selection and existing route/action behavior.
The rename does not add MCP project discovery to them. Builds clear `dist` before
compilation so renamed executables and dispatcher modules cannot survive in a
packed artifact as stale files.

A real subprocess check exposed a pre-existing custom STDIO feedback loop:
`readline.write()` fed each reply into the input parser again. The legacy
dispatcher now uses a separate stdout writer, injectable in tests. This restores
the intended action response and EOF shutdown behavior without changing action
names, response fields, status values, or error codes.

## Deferred work

Streamable HTTP, including a standard `/mcp` endpoint, is deferred. DDEV/Lando
execution backends are deferred. Neither is introduced by this migration.

Publication to npm and the MCP Registry remains deferred until local tarball
proof is accepted and publication is authorized. Automated packed-consumer proof
has passed; that evidence does not by itself authorize publication or satisfy
MCP Inspector and final real-project acceptance gates.

## Legacy removal criteria

Do not remove the legacy adapters until all of the following hold:

- At least one released version has shipped with standard MCP support.
- No known downstream consumer requires the legacy action-STDIO interface.
- The HTTP API has either a documented independent use case or is removed as
  part of an explicitly reviewed compatibility change.

Until those criteria are met, standard MCP, legacy REST, and legacy action-STDIO
must continue to pass their respective compatibility tests.
