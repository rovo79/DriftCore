# Security and risks

## Local trust boundary

Standard MCP STDIO runs as the same local user as its MCP client. Its four project resources expose project metadata; the tools can inspect a Drupal codebase and the three guarded workflows can change it after preview. Grant access to trusted local clients and projects. Standard MCP does not open a network listener.

The Legacy REST API binds to `127.0.0.1` by default and has no authentication. It is not Streamable HTTP MCP. Do not expose it as a multi-user or remote service on the assumption that it has MCP security semantics. The Legacy DriftCore action-STDIO adapter uses a custom JSON-line protocol, not standard MCP.

## Implemented controls

- Fixed Drush/Composer command arguments and `spawn(..., { shell: false })`; arbitrary command execution is not exposed by a tool.
- Configurable command timeouts, process termination on timeout, and a `maxParallelCli` concurrency limit (default `1`).
- Short-lived, single-use preview tokens, constrained filesystem paths, and verification for apply workflows.
- Legacy REST cross-origin request rejection, request body size bounds, and per-client-IP rate limiting when a valid configuration enables the limiter. HTTP has no authentication.
- Optional output redaction (`redaction.enabled`, default false) and truncated CLI stderr in mapped errors. Do not assume that every local path is hidden when redaction is disabled.
- MCP protocol-only stdout and stderr operational diagnostics; invalid project selection fails startup.

## Remaining risks

- Reads can reveal Composer dependencies, extension names, configuration layout, and paths to the local client. Write tools can alter the selected project after a valid preview token.
- A local client runs with its user's filesystem and executable privileges. `executeInSandbox` remains a stub, not a general sandbox.
- Binding legacy REST beyond loopback would expose unauthenticated endpoints. IP rate limits and origin rejection are not substitutes for authentication or authorization.
- Response redaction is opt-in; diagnostic messages may contain local paths when it is off.

Authenticated remote access, a general sandbox, and Streamable HTTP are outside the current migration. See [the transport decision](../decisions/standard-mcp-stdio.md).
