# DriftCore

> Drupal project operations for AI coding and maintenance agents.

DriftCore is an experimental Model Context Protocol server that gives AI agents structured, authoritative context about a Drupal project and guarded access to Drupal engineering workflows.

It runs alongside a local or containerized Drupal codebase. Instead of asking an agent to infer project state from arbitrary filesystem searches and shell output, DriftCore exposes Drupal-aware resources and named operations backed by project discovery, Drush, and Composer.

The active implementation is in [`packages/server`](packages/server).

## What DriftCore does

DriftCore currently provides three layers of capability.

### Project context

Agents can inspect:

* the Drupal root and core version
* Composer project metadata and dependencies
* installed, enabled, and custom modules and themes
* configuration sync layout and environment indicators
* project readiness checks and available capabilities

### Read-only assessments

Agents can request structured assessments for:

* available Drupal and Composer upgrades
* active configuration drift
* planned custom module scaffolding

### Guarded write workflows

DriftCore implements bounded write workflows for:

* rebuilding Drupal caches
* creating a minimal custom module scaffold
* exporting Drupal configuration

Each write workflow follows the same lifecycle:

```text
preview → apply → verify
```

A preview returns the intended operation and a short-lived token. Apply requires that token and consumes it so it cannot be reused. Verification then inspects the resulting project state.

## Why DriftCore

General-purpose coding agents can read files and execute commands, but they do not automatically understand the operational structure of a Drupal project.

Without a Drupal-aware interface, an agent may need to guess:

* where the real Drupal root is
* whether Drush and Composer are available
* which extensions are custom
* how configuration is organized
* which operations are safe to perform
* how to verify that a change succeeded

DriftCore turns those concerns into explicit resources and tools. The goal is not unrestricted automation. The goal is controlled, inspectable, and verifiable Drupal project operations.

## Safety model

DriftCore is designed around bounded capabilities rather than general shell access.

Current safeguards include:

* fixed Drupal and Composer command paths
* subprocess execution without a shell
* per-command timeouts
* configurable concurrency limits
* short-lived, single-use preview tokens for write operations
* filesystem boundary checks for generated files
* post-apply verification
* localhost HTTP binding by default
* cross-origin request rejection
* request body limits
* configurable output redaction
* per-client HTTP rate limiting

DriftCore remains experimental. It does not currently provide a complete authentication and authorization system for remote or multi-user deployment.

## Requirements

* Node.js 20 or newer
* npm 9 or newer
* a local Drupal project
* Drush for Drupal inspection and Drush-backed workflows
* Composer for dependency inspection and upgrade assessment

Project-local executables such as `vendor/bin/drush` are supported.

## Quick start

From the repository root:

```bash
npm --prefix packages/server install
npm --prefix packages/server run build
```

Create a configuration file:

```json
{
  "drupalRoot": "/absolute/path/to/drupal/web"
}
```

Save it as `driftcore.config.json` in the current working directory, or point `DRIFTCORE_CONFIG` to it:

```bash
export DRIFTCORE_CONFIG=/absolute/path/to/driftcore.config.json
```

Start the STDIO transport:

```bash
npm --prefix packages/server run start:stdio
```

Or start the HTTP transport:

```bash
npm --prefix packages/server run start:http -- --port 8080
```

The HTTP server binds to `127.0.0.1` by default.

## Configuration

A minimal configuration only requires `drupalRoot`.

```json
{
  "drupalRoot": "/absolute/path/to/drupal/web",
  "drushPath": "/absolute/path/to/vendor/bin/drush",
  "composerPath": "/absolute/path/to/composer",
  "customModuleDirs": [
    "web/modules/custom"
  ],
  "customThemeDirs": [
    "web/themes/custom"
  ],
  "maxParallelCli": 1,
  "timeouts": {
    "drushStatusMs": 10000,
    "drushPmlMs": 15000,
    "composerInfoMs": 8000,
    "composerOutdatedMs": 30000
  },
  "cacheTtlMs": {
    "projectManifest": 5000,
    "pml": 5000
  },
  "redaction": {
    "enabled": false,
    "placeholder": "[redacted]"
  },
  "rateLimit": {
    "windowMs": 60000,
    "maxRequests": 60
  }
}
```

When executable paths are omitted, DriftCore first looks for project-local binaries and then falls back to commands available on `PATH`.

## Resources

### `project_manifest`

Returns a consolidated project summary including the Drupal root, Drupal core version, Composer state, custom modules, and custom themes.

### `project_modules`

Returns discovered module and theme state. DriftCore uses Drush when available and falls back to filesystem discovery for custom extensions.

### `project_config_layout`

Reports the detected configuration sync directory, Config Split indicators, environment-related configuration hints, and the detection method used.

### `project_checks`

Reports project readiness and capability flags, including Drupal root validity, binary availability, Composer metadata, and configuration sync detection.

### Template resources

The resource catalog also contains static contract/testing templates:

* `schema.entityTypes`
* `config.exported`
* the template descriptor for `project_manifest`

These templates are not dynamically discovered from the connected Drupal project and should not be treated as authoritative project data.

## Tools and workflows

### Inspection tools

* `drift.drush_status`
* `drift.drush_pml`
* `drift.composer_info`
* `drift.composer_outdated`

### Read-only workflow tools

* `drift.upgrade_assessment`
* `drift.config_drift_assessment`
* `drift.scaffold_plan`

### Guarded write workflow tools

* `drift.cache_rebuild`
* `drift.module_scaffold`
* `drift.config_export`

The write tools expose separate preview, apply, and verify operations through the transports.

## HTTP interface

### Discovery and inspection routes

```text
GET /health
GET /resources
GET /tools
GET /project-manifest
GET /project-modules
GET /project-config-layout
GET /project-checks
GET /drush/status
GET /drush/pml
GET /composer/info
GET /composer/outdated
```

### Read-only workflow routes

```text
GET /workflows/upgrade-assessment
GET /workflows/config-drift
GET /workflows/scaffold-plan?machine_name=acme_blog&target_type=module
```

### Cache rebuild workflow

```text
GET  /workflows/cache-rebuild/preview
POST /workflows/cache-rebuild/apply
GET  /workflows/cache-rebuild/verify
```

Apply body:

```json
{
  "preview_token": "token returned by preview"
}
```

### Module scaffold workflow

```text
GET  /workflows/scaffold/preview?machine_name=acme_blog&target_type=module
POST /workflows/scaffold/apply
GET  /workflows/scaffold/verify?machine_name=acme_blog&target_type=module
```

Apply body:

```json
{
  "machine_name": "acme_blog",
  "target_type": "module",
  "preview_token": "token returned by preview"
}
```

### Configuration export workflow

```text
GET  /workflows/config-export/preview
POST /workflows/config-export/apply
GET  /workflows/config-export/verify
```

Apply body:

```json
{
  "preview_token": "token returned by preview"
}
```

## STDIO interface

The STDIO transport accepts one JSON request per line.

Example:

```json
{"id":1,"action":"project_manifest"}
```

Available actions:

```text
resources
tools
project_manifest
project_modules
project_config_layout
project_checks
drush_status
drush_pml
composer_info
composer_outdated
upgrade_assessment
config_drift_assessment
scaffold_plan
cache_rebuild_preview
cache_rebuild_apply
cache_rebuild_verify
scaffold_preview
scaffold_apply
scaffold_verify
config_export_preview
config_export_apply
config_export_verify
```

Parameters are supplied through the `params` object:

```json
{
  "id": 2,
  "action": "scaffold_preview",
  "params": {
    "machine_name": "acme_blog",
    "target_type": "module"
  }
}
```

## Response model

Resources and tools use a shared response envelope.

```json
{
  "status": "ok",
  "data": {}
}
```

Supported status values are:

* `ok`
* `degraded`
* `error`
* `timeout`
* `not_configured`

A response may also include a structured `error` with a machine-readable code, message, and diagnostics.

Write operations additionally report their observed changes, and verification operations report whether the resulting state was confirmed.

## Scope and boundaries

DriftCore operates on Drupal's **project and engineering plane**.

It is intended for coding, maintenance, upgrade, diagnostic, and controlled operations agents working on the Drupal system itself.

It is not a content-management endpoint for agents working with production content. It does not currently expose Drupal content entities, media, taxonomy, users, or editorial workflows through Drupal's runtime permission system.

Those are complementary layers:

```text
Content and business agents
          ↓
Drupal content MCP
          ↓
Entities, media, taxonomy, and editorial workflows


Coding and maintenance agents
          ↓
DriftCore
          ↓
Project context, Drush, Composer, and guarded operations
```

A Drupal installation could use both: one interface for agents working with information managed by Drupal, and DriftCore for agents working safely on the Drupal project.

DriftCore is also not currently:

* a multi-agent orchestration platform
* a general-purpose sandbox for untrusted code
* a generated SDK platform
* a replacement for Drupal authentication or entity access control

The separate runner, general sandbox, and generated SDK concepts have been explicitly deferred. Known workflow sequencing and safety boundaries remain inside `packages/server`.

## Project documentation

* [Architecture](docs/ai/ARCHITECTURE.md)
* [Codebase map](docs/ai/CODEBASE_MAP.md)
* [Commands](docs/ai/COMMANDS.md)
* [Deployment](docs/ai/DEPLOYMENT.md)
* [Security and risks](docs/ai/SECURITY_AND_RISKS.md)
* [Testing](docs/ai/TESTING.md)
* [Runner, sandbox, and SDK decision](docs/decisions/runner-sandbox-sdk.md)

## Testing

Run the server test suite:

```bash
npm --prefix packages/server test
```

Run the TypeScript validation without emitting files:

```bash
npm --prefix packages/server run lint
```

Run the HTTP integration smoke test:

```bash
npm --prefix packages/server run integration
```

## Roadmap

Near-term work includes:

* stabilizing and versioning the public transport and response contracts
* expanding contract and workflow coverage
* replacing static template resources with project-discovered data where appropriate
* strengthening security for any deployment beyond a trusted local environment
* broadening the set of bounded Drupal maintenance workflows
* improving packaging and client integration documentation

## License

MIT
::: 
