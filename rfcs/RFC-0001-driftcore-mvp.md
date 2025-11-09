# RFC-0001: DriftCore MVP

## Summary

This RFC captures the goals, architecture, and non-goals for the DriftCore minimum viable product. The MVP focuses on enabling automation agents to introspect Drupal metadata, trigger Drush commands, and experiment safely in a sandboxed Drupal 11 environment.

## Goals

- Provide an MCP server that exposes Drupal schema and configuration as machine-readable resources (`schema.entityTypes`, `config.exported`).
- Surface Drush commands (`drush.cacheRebuild`, `drush.configExport`) through the MCP tool catalog.
- Deliver an agent runner that can generate a language SDK from the server resources and execute code safely in a sandbox.
- Offer a containerized Drupal 11 sandbox that mirrors the metadata shared by the MCP server.
- Establish a CI workflow that validates builds, static analysis, unit tests, and integration smoke tests for both packages.

## Architecture

- **MCP Server (`@driftcore/server`)**: Provides HTTP and STDIO transports. Default resources are generated from canonical Drupal metadata and are available over `/resources`. Drush tooling is exposed via the `/tools` endpoint.
- **Agent Runner (`@driftcore/agent-runner`)**: Fetches resources from the MCP server, generates a TypeScript SDK, and executes bootstrap code inside a VM-backed sandbox.
- **Drupal Sandbox**: Docker Compose project (`examples/drupal-sandbox`) with Drupal 11 and MariaDB containers. Configuration exports are mounted for inspection.
- **Continuous Integration**: GitHub Actions workflow builds each package, runs type-checking lint, executes unit tests with Node's test runner, and performs smoke-level integration checks.

## Non-goals

- Full MCP protocol compliance (message envelopes, session management) is deferred to a future iteration.
- Production-grade sandbox isolation and resource quotas.
- Automated Drupal installation or configuration management beyond the provided example export.
- SDK generation for languages other than TypeScript.
