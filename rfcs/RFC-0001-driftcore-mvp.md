# RFC-0001: DriftCore MVP

**Status:** Proposed

## Summary

This RFC defines the vision, boundaries, and delivery milestones for the DriftCore minimum viable product. The MVP empowers automation agents to introspect Drupal metadata, execute vetted Drush commands, and iterate safely inside a sandboxed Drupal 11 environment while feeding actionable guidance back to a copilot interface.

## Problem

Drupal automation today requires a patchwork of ad-hoc scripts, disconnected metadata dumps, and manual Drush usage across teams. This fragmentation slows experimentation, makes it difficult for agents to reason about a site’s current state, and introduces risk when replicating production workflows in local sandboxes. DriftCore centralizes metadata access, tool execution, and sandbox orchestration so automation agents can follow a cohesive workflow.

## Goals

- Provide a Machine Control Protocol (MCP) server that exposes Drupal schema and configuration as machine-readable resources such as `schema.entityTypes` and `config.exported`.
- Publish an allowlisted catalog of tools—including `drush.cacheRebuild`, `drush.configExport`, and scaffolding utilities—that agents can invoke through the MCP transport.
- Deliver an agent runner capable of generating a language SDK from the MCP schema, executing workflows in isolated sandboxes, and reporting progress to the copilot.
- Offer a containerized Drupal 11 sandbox that mirrors the metadata surfaced by the MCP server so agents can round-trip changes predictably.
- Establish a CI workflow that validates builds, static analysis, unit tests, and integration smoke tests across all packages.

## MVP Scope

### Resources

| Identifier | Description | Format |
| --- | --- | --- |
| `schema.entityTypes` | Canonical Drupal entity type definitions harvested via Drush and serialized for MCP consumption. | JSON Schema |
| `schema.fields` | Field storage and instance metadata normalized for agents. | JSON Schema |
| `config.exported` | Exported configuration snapshots with digests so agents can reason about drift. | TAR reference + manifest |
| `config.state` | Read-only snapshot of stateful configuration that is safe to expose (e.g., feature flags). | JSON |
| `docs.guides` | Curated quick-start and troubleshooting documentation surfaced in the copilot UI. | Markdown |

### Tools

| Identifier | Purpose | Notes |
| --- | --- | --- |
| `drush.cacheRebuild` | Clears Drupal caches and returns structured logs for the agent transcript. | Supports subset of flags with validation. |
| `drush.configExport` | Produces a tarball reference that agents can download for configuration diffing. | Output stored in sandbox artifacts volume. |
| `drush.entitySchema` | Triggers a schema refresh for a specific entity type when the sandbox changes. | Requires entity type argument. |
| `scaffold.module` | Generates Drupal module boilerplate using pluggable templates. | Respects sandbox namespace conventions. |
| `qa.runTests` | Executes the QA command chain defined in the Testing Strategy section. | Equivalent to running `pnpm lint && pnpm test && pnpm --filter @driftcore/server test:integration`. |

### Flagship Workflows

1. **Metadata Inspection** – The copilot requests `schema.entityTypes` and `schema.fields`, summarizes deltas versus previous runs, and recommends schema-aligned scaffolds.
2. **Safe Experimentation Loop** – The agent runner scaffolds a module, applies targeted changes, runs `qa.runTests`, and reverts the sandbox between iterations.
3. **Configuration Drift Analysis** – The copilot fetches `config.exported`, compares it with a baseline digest, and proposes remediation steps using `drush.configExport` and `drush.cacheRebuild`.

## Architecture Overview

```text
+----------------+      HTTP / STDIO      +--------------------+
|  Copilot (UI)  | <--------------------> |   MCP Server API   |
+----------------+                        +---------+----------+
                                                   |
                                                   | SDK generation / Tool calls
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

### Component Listing

- **MCP Server (`@driftcore/server`)** – Provides HTTP and STDIO transports. Default resources derive from canonical Drupal metadata and are served through `/resources`. Tool adapters are exposed via `/tools` with allowlisted arguments.
- **Agent Runner (`@driftcore/agent-runner`)** – Fetches resources from the MCP server, generates a TypeScript SDK, and orchestrates workflows inside VM-backed sandboxes with rollback guarantees.
- **Copilot Extension (`apps/copilot-extension`)** – Displays resources, tool results, and workflow progress. Offers UX affordances to kick off flagship workflows and review telemetry.
- **Drupal Sandbox (`examples/drupal-sandbox`)** – Docker Compose environment with Drupal 11 and MariaDB containers. Configuration exports are mounted for inspection and synchronization with the MCP server.
- **Continuous Integration** – GitHub Actions pipeline builds each package, runs linting and unit tests, and performs smoke-level integration checks, mirroring the `qa.runTests` chain.

## Agent Runner Behavior

- Polls the MCP server catalog for changes and regenerates the SDK when resource metadata shifts.
- Executes workflows in isolated microVM processes with strict CPU, memory, and wall-clock limits.
- Persists run metadata (tool invocations, outputs, and status) for observability hooks and resumability.
- Supports resumable sessions so interrupted runs restart from the last completed workflow step.
- Emits structured events consumable by the copilot extension and external telemetry sinks.

## Security Defaults

- Sandbox containers run as non-root users with read-only mounts for exported configuration and no outbound network access by default.
- Drush tools are constrained to a vetted allowlist, enforce argument validation, and redact sensitive output.
- Secrets required by Drupal (database credentials, salts) are injected via `.env` files that never surface through MCP resources.
- Agent-executed code runs inside snapshot-based microVMs to guarantee rollback after each workflow iteration.
- Telemetry webhooks require signed requests to prevent command injection through observability pipelines.

## Developer Experience & Observability Expectations

### Developer Experience

- Publish TypeScript SDKs with inline JSDoc generated from MCP resource metadata for rich autocompletion.
- Provide verbose logging toggles (`DEBUG=driftcore:*`) that cover MCP transport, tool execution, and sandbox orchestration.
- Document common troubleshooting scenarios and CLI recipes in `docs/guides`, surfaced via the `docs.guides` resource.
- Maintain examples in `examples/` demonstrating how to combine resources and tools for each flagship workflow.
- Offer project generators and scaffolds (`create-driftcore-app`) that encode recommended defaults for new adopters.

### Observability

- Expose Prometheus-compatible metrics from the agent runner (workflow duration, tool error rates, sandbox resets).
- Emit structured audit logs for every tool invocation, linked back to copilot sessions for human review.
- Capture sandbox snapshots and workflow transcripts as artifacts accessible through the copilot UI.
- Provide alerting defaults for prolonged workflow runtimes, repeated sandbox rollbacks, and failed QA chains.
- Maintain Grafana-ready dashboards and runbooks that highlight MCP latency spikes and sandbox health regressions.

## Testing Strategy

- **Unit Tests** – Cover MCP resource serialization, tool adapters, and agent runner orchestration primitives.
- **Integration Tests** – Stand up the Drupal sandbox, run the agent runner against mock workflows, and verify end-to-end success criteria.
- **QA Command Chain** – `pnpm lint`, `pnpm test`, and `pnpm --filter @driftcore/server test:integration`, orchestrated collectively via `qa.runTests`.
- **Contract Tests** – Validate SDK generation against canonical MCP schema snapshots to ensure backward compatibility.
- **Performance Probes** – Measure tool round-trip latency and sandbox reset times with thresholds enforced in CI.

## Milestones (M0–M4)

| Milestone | Scope | Exit Criteria |
| --- | --- | --- |
| **M0 – Project Skeleton** | Repository setup, package workspaces, and baseline CI lint/test wiring. | Lerna/PNPM workspaces defined, CI green on scaffolding commit. |
| **M1 – MCP Foundation** | Implement core resources (`schema.entityTypes`, `config.exported`) and expose Drush tooling over HTTP/STDIO. | MCP server returns canonical data; `drush.cacheRebuild` callable via MCP. |
| **M2 – Agent Runner Alpha** | SDK generation, VM sandbox execution, and Metadata Inspection workflow. | Agent runner completes Metadata Inspection end-to-end with telemetry. |
| **M3 – Sandbox Experimentation** | Module scaffolding tooling and Safe Experimentation Loop workflow plus integration coverage. | `scaffold.module` + `qa.runTests` loop succeeds inside sandbox CI job. |
| **M4 – Observability & Hardening** | Telemetry pipelines, security enforcement, configuration drift workflow, release candidate readiness. | Drift analysis workflow operational; observability dashboards populated; release notes drafted. |

## Versioning Strategy

- Use semantic versioning per package with an MVP cap of `0.1.0` until workflows stabilize.
- Tag milestone completions with annotated git tags (`m0`, `m1`, …) to signal checkpoints.
- Maintain per-package changelog entries in `CHANGELOG.md`, updated through the pull-request template.
- Enforce compatibility guarantees for MCP resource shapes and tool contracts once the MVP reaches version `0.5.0`.

## Open Questions

- Should the MCP server stream resource diffs or require full fetches for large configuration exports?
- What is the minimum viable telemetry sink (self-hosted Loki versus managed service) for launch?
- How should secrets rotation be automated for the sandbox environment without exposing credentials to agents?
- Can the agent runner reuse VM snapshots across workflows to reduce startup latency without sacrificing isolation?
- What governance process should review additions to the MCP tool allowlist to prevent privilege escalation?

## Non-goals

- Full MCP protocol compliance (message envelopes, session management) is deferred to a future iteration.
- Production-grade sandbox isolation and resource quotas beyond the documented defaults.
- Automated Drupal installation or configuration management beyond the provided example export.
- SDK generation for languages other than TypeScript during the MVP phase.
