# RFC-0001: DriftCore MVP

## Summary

This RFC captures the goals, architecture, and non-goals for the DriftCore minimum viable product. The MVP focuses on enabling automation agents to introspect Drupal metadata, trigger Drush commands, and experiment safely in a sandboxed Drupal 11 environment.

## Goals

- Provide an MCP server that exposes Drupal schema and configuration as machine-readable resources (`schema.entityTypes`, `config.exported`).
- Surface Drush commands (`drush.cacheRebuild`, `drush.configExport`) through the MCP tool catalog.
- Deliver an agent runner that can generate a language SDK from the server resources and execute code safely in a sandbox.
- Offer a containerized Drupal 11 sandbox that mirrors the metadata shared by the MCP server.
- Establish a CI workflow that validates builds, static analysis, unit tests, and integration smoke tests for both packages.

## MVP Scope

### Resources

- `schema.entityTypes`: Canonical Drupal entity type definitions harvested via Drush and serialized as JSON Schema for the MCP resources API.
- `schema.fields`: Field storage and field instance metadata, normalized for agent consumption.
- `config.exported`: Exported Drupal configuration with checksum metadata so agents can reason about drift.
- `config.state`: Read-only snapshot of stateful configuration that is safe to surface to agents.
- `docs.guides`: Curated quick-start documentation that can be displayed directly in the copilot UI.

### Tools

- `drush.cacheRebuild`: Clears Drupal caches and returns status output/logging for the agent transcript.
- `drush.configExport`: Produces a tarball or directory reference that agents can download for analysis.
- `drush.entitySchema`: On-demand schema refresh for a specific entity type when the sandbox changes.
- `scaffold.module`: Generates Drupal module boilerplate in the sandbox using pluggable templates.
- `qa.runTests`: Executes the QA command chain defined under the Testing Strategy section.

### Flagship Workflows

1. **Metadata Inspection** – The copilot requests `schema.entityTypes` and `schema.fields`, summarizes differences against prior runs, and recommends schema-aligned code scaffolds.
2. **Safe Experimentation Loop** – The agent runner scaffolds a module, applies targeted changes, runs `qa.runTests`, and reverts the sandbox between iterations.
3. **Configuration Drift Analysis** – The copilot fetches `config.exported`, compares it to a baseline digest, and suggests remediation steps using `drush.configExport` and `drush.cacheRebuild`.

## Architecture

```
+----------------+      HTTP / STDIO      +--------------------+
|  Copilot (UI)  | <--------------------> |  MCP Server API    |
+----------------+                        +---------+----------+
                                                   |
                                                   | SDK Generation / Tool Calls
                                                   v
                                          +--------+---------+
                                          | Agent Runner VM  |
                                          +--------+---------+
                                                   |
                                                   | Drush / Filesystem / DB
                                                   v
                                     +-------------+--------------+
                                     | Drupal 11 Sandbox (Docker) |
                                     +----------------------------+
```

### Component Overview

- **MCP Server (`@driftcore/server`)**: Provides HTTP and STDIO transports. Default resources are generated from canonical Drupal metadata and are available over `/resources`. Drush tooling is exposed via the `/tools` endpoint.
- **Agent Runner (`@driftcore/agent-runner`)**: Fetches resources from the MCP server, generates a TypeScript SDK, and executes bootstrap code inside a VM-backed sandbox. Handles workflow orchestration and safe rollback for experiments.
- **Copilot Extension (`apps/copilot-extension`)**: Presents resources, tool results, and workflow progress to the user. Provides UX affordances for the flagship workflows.
- **Drupal Sandbox**: Docker Compose project (`examples/drupal-sandbox`) with Drupal 11 and MariaDB containers. Configuration exports are mounted for inspection and synchronization with the MCP server.
- **Continuous Integration**: GitHub Actions workflow builds each package, runs type-checking lint, executes unit tests with Node's test runner, and performs smoke-level integration checks.

## Agent Runner Behavior

- Periodically refreshes the MCP server catalog and regenerates the SDK when resource metadata changes.
- Executes workflows in isolated VM processes with explicit timeouts and resource limits.
- Persists run metadata (tool invocations, outputs, status) for observability hooks.
- Provides resumable sessions: in the event of interruption the runner can resume from the last completed step of a flagship workflow.
- Emits structured events to the copilot extension for display and to external telemetry sinks.

## Security Defaults

- Sandbox containers run with non-root users, readonly mounts for exported configuration, and no outbound network access by default.
- Drush commands exposed as tools are constrained to a vetted allowlist with argument validation.
- Secrets required by Drupal (database credentials, salts) are injected via `.env` files that are never surfaced through MCP resources.
- Agent runner executes user-provided code inside firecracker-style microVMs with filesystem snapshots to guarantee rollback.
- Telemetry endpoints require signed requests to prevent command injection through observability pipelines.

## Developer Experience & Observability

- Ship TypeScript SDKs with inline JSDoc generated from MCP resource metadata for autocompletion in editors.
- Provide verbose logging toggles (`DEBUG=driftcore:*`) covering MCP transport, tool execution, and sandbox orchestration.
- Expose Prometheus-compatible metrics from the agent runner (workflow duration, tool error rates, sandbox resets).
- Include structured audit logs for tool invocations, linked back to copilot sessions for review.
- Document common troubleshooting scenarios and CLI recipes in `docs/guides` surfaced via the `docs.guides` resource.

## Testing Strategy

- **Unit Tests**: Cover MCP resource serialization, tool adapters, and agent runner orchestration primitives.
- **Integration Tests**: Stand up the Drupal sandbox, run the agent runner against mock workflows, and verify end-to-end success criteria.
- **QA Command Chain**: `pnpm lint`, `pnpm test`, `pnpm --filter @driftcore/server test:integration`, and sandbox smoke tests triggered via `qa.runTests`.
- **Contract Tests**: Validate SDK generation against canonical MCP schema snapshots to ensure backwards compatibility.
- **Performance Probes**: Measure tool round-trip latency and sandbox reset times with thresholds enforced in CI.

## Milestones

- **M0 – Project Skeleton**: Repository setup, package workspaces, basic CI lint/test wiring.
- **M1 – MCP Foundation**: Implement core resources (`schema.entityTypes`, `config.exported`) and expose Drush tooling via HTTP.
- **M2 – Agent Runner Alpha**: SDK generation, VM sandbox execution, and the Metadata Inspection workflow.
- **M3 – Sandbox Experimentation**: Scaffold module tooling, Safe Experimentation Loop workflow, integration test coverage.
- **M4 – Observability & Hardening**: Telemetry pipelines, security defaults enforced, configuration drift workflow, release candidate readiness.

## Versioning

- Use semantic versioning per package with an MVP cap of `0.1.0` until workflows stabilize.
- Tag milestone completions with annotated git tags (`m0`, `m1`, …) to signal checkpoints.
- Maintain changelog entries in `CHANGELOG.md` per package, updated via PR templates.
- Enforce compatibility guarantees for MCP resource shapes and tool contracts once the MVP reaches `0.5.0`.

## Open Questions

- Should the MCP server stream resource diffs or require full fetches for large configuration exports?
- What is the minimum viable telemetry sink (self-hosted Loki vs. managed service) for observability launch?
- How should secrets rotation be automated for the sandbox environment without exposing credentials to agents?
- Can the agent runner reuse VM snapshots across workflows to reduce startup latency without sacrificing isolation?
- What governance process should review additions to the MCP tool allowlist to prevent privilege escalation?

## Non-goals

- Full MCP protocol compliance (message envelopes, session management) is deferred to a future iteration.
- Production-grade sandbox isolation and resource quotas.
- Automated Drupal installation or configuration management beyond the provided example export.
- SDK generation for languages other than TypeScript.
