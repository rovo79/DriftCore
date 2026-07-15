# DriftCore

> Drupal project operations for AI coding and maintenance agents.

DriftCore is a Model Context Protocol server that gives AI agents structured, authoritative context about a Drupal project and controlled access to Drupal engineering tools.

It runs alongside a local or containerized Drupal codebase. Instead of requiring an agent to infer project state from arbitrary filesystem searches and shell output, DriftCore exposes stable Drupal-aware resources and named operations backed by project discovery, Drush, and Composer.

> **Status:** Experimental. The active implementation is located in `packages/server`.

## Why DriftCore

General-purpose coding agents can read files and execute commands, but they do not automatically understand the operational structure of a Drupal project.

They may need to determine:

* where the Drupal root is located
* which version of Drupal core is installed
* which modules and themes are custom
* which extensions are enabled
* what Composer dependencies are installed
* which packages are outdated
* whether Drush and related project tools are available

DriftCore turns this information into structured MCP resources and tools so agents can work from explicit project facts rather than brittle assumptions.

## What DriftCore does today

The current server provides:

### Project discovery

* Drupal root discovery
* Drupal core version detection
* Composer project metadata
* custom module discovery
* custom theme discovery
* a consolidated `project_manifest` resource

### Drush inspection

* `drift.drush_status`
* `drift.drush_pml`

### Composer inspection

* `drift.composer_info`
* `drift.composer_outdated`

### MCP transports

* HTTP
* STDIO using line-delimited JSON actions

### Structured responses

Resources and tools use a shared response envelope:

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

Responses may include:

* `data`
* `error`

## Operating model

DriftCore is designed around bounded, observable Drupal operations.

The current public capabilities are primarily read-only inspection tools. Future state-changing workflows are expected to follow this sequence:

```text
inspect → plan → preview → apply → verify
```

This means an agent should be able to:

1. inspect the current project state
2. produce a proposed operation
3. preview its expected effects
4. apply the operation explicitly
5. verify the resulting state

The public tool surface should expose named Drupal-aware operations rather than unrestricted shell execution.

## Quick start

### 1. Install dependencies

From the repository root:

```bash
npm --prefix packages/server install
```

### 2. Build the server

```bash
npm --prefix packages/server run build
```

### 3. Configure the Drupal project

DriftCore can load its configuration from either:

* the path specified by `DRIFTCORE_CONFIG`
* `driftcore.config.json` in the current working directory

Example:

```json
{
  "drupalRoot": "/absolute/path/to/drupal/web"
}
```

Using an explicit configuration path:

```bash
export DRIFTCORE_CONFIG=/absolute/path/to/driftcore.config.json
```

### 4. Start a transport

Start the STDIO transport:

```bash
npm --prefix packages/server run start:stdio
```

Start the HTTP transport:

```bash
npm --prefix packages/server run start:http -- --port 8080
```

## HTTP interface

The current HTTP transport exposes these read routes:

```text
GET /health
GET /resources
GET /tools
GET /project-manifest
GET /drush/status
GET /drush/pml
GET /composer/info
GET /composer/outdated
```

## STDIO interface

The current STDIO transport supports these actions:

```text
resources
tools
project_manifest
drush_status
drush_pml
composer_info
composer_outdated
```

## Resources and tools

### Implemented resources

#### `project_manifest`

Returns a discovered summary of the Drupal project, including:

* Drupal root
* Drupal core version
* Composer metadata
* custom modules
* custom themes

### Implemented tools

#### `drift.drush_status`

Wraps:

```bash
drush status --format=json
```

#### `drift.drush_pml`

Wraps:

```bash
drush pm:list --format=json
```

#### `drift.composer_info`

Reads and summarizes:

```text
composer.json
composer.lock
```

#### `drift.composer_outdated`

Wraps:

```bash
composer outdated --format=json
```

### Template resources

The following resources currently return static template data:

* `schema.entityTypes`
* `config.exported`

These are not yet derived from the connected Drupal project and should not be treated as authoritative project facts.

Replacing these templates with discovered project data is part of the roadmap.

## Contract documentation

The versioned response and compatibility contract is documented in:

```text
packages/server/docs/CONTRACT.md
```

## Architecture

```text
packages/server/src/
├── index.ts
│   └── Wires configuration, resources, tools, and transports
├── config.ts
│   └── Loads configuration, resolves paths, and applies defaults
├── types.ts
│   └── Shared types, response envelopes, and status taxonomy
├── bin/
│   ├── http.ts
│   └── stdio.ts
├── transports/
│   ├── http.ts
│   └── stdio.ts
├── features/
│   ├── cache.ts
│   ├── composerTools.ts
│   ├── drushTools.ts
│   ├── errorMapping.ts
│   ├── projectManifest.ts
│   ├── projectPaths.ts
│   ├── sandboxExecution.ts
│   ├── schemaResources.ts
│   └── sdkGeneration.ts
├── __tests__/
└── integration/
    └── smoke.ts
```

## Scope and boundaries

DriftCore operates on the **project and engineering plane** of Drupal.

It is intended for agents that need to understand, diagnose, maintain, or eventually modify the Drupal system itself.

Examples include:

* coding agents
* maintenance agents
* upgrade assistants
* dependency-management agents
* project-diagnostic tools
* controlled DevOps workflows

DriftCore is not currently a content-management MCP endpoint.

It does not expose Drupal content entities, media libraries, taxonomy, or editorial workflows as an agent-facing CMS interface. Those capabilities belong to a content-facing integration implemented through Drupal’s own authentication, permissions, entity APIs, and workflow systems.

The two approaches are complementary:

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

A Drupal project could use both layers: one for agents working with the information managed by Drupal, and another for agents working safely on the Drupal project.

DriftCore is also not currently:

* a multi-agent orchestration platform
* a general-purpose command sandbox
* an SDK generator
* a replacement for Drupal authentication
* a replacement for Drupal entity access control

## Deferred and placeholder components

Some source files represent deferred or placeholder capabilities rather than completed product features.

These include:

* general sandbox execution
* SDK generation
* broader schema discovery
* configuration discovery
* state-changing operational workflows

Their presence in the repository should not be interpreted as evidence that those capabilities are currently implemented.

## Roadmap

Planned work includes:

* stabilizing and versioning public response contracts
* expanding contract and compatibility tests
* adding authentication and localhost enforcement
* adding sensitive-data redaction
* adding rate limiting
* replacing static schema templates with discovered Drupal facts
* replacing static configuration templates with discovered project configuration
* adding workflow primitives for:

  * inspect
  * plan
  * preview
  * apply
  * verify

## License

MIT
