# Feature Specification: DriftCore v0.1 Single-Project MCP Server

**Feature Branch**: `[001-driftcore-single-project]`  
**Created**: 2025-11-18  
**Status**: Draft  
**Input**: User description: "DriftCore v0.1 will be a single-project MCP server that attaches to a Drupal codebase and exposes read only, structured insight into that project for external agents. It must load a configurable Drupal root, detect Drupal core version, custom modules, and themes, and expose this via a `project_manifest` resource. It must provide a small, fixed set of tools that run safe, whitelisted Drush and Composer commands (`drush status`, module and theme listings, composer manifest inspection, and outdated package checks) and return predictable JSON style structures rather than raw text. No tools in v0.1 are allowed to modify code, config, or the database, and all errors must be surfaced as structured, human understandable responses without crashing the server. The system must be simple to configure, stable even when Drush or Composer fail, and documented clearly enough that a Drupal developer can point it at a project, connect an MCP compatible client, and use these resources and tools without needing to understand the internal implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover real project context (Priority: P1)

As a Drupal developer, I can point DriftCore at a single Drupal project and retrieve a `project_manifest` resource that accurately reports the Drupal root, core version, Composer dependencies, and custom modules/themes, so that agents can reason about the project without guessing.

**Why this priority**: All other tools and behaviors depend on having correct, project-aware context. Without reliable `project_manifest` data, agents cannot safely propose changes or interpret Drush/Composer output.

**Independent Test**: Start DriftCore against a known Drupal project, call `project_manifest` via an MCP client, and compare the returned structure to the actual filesystem and `composer.json` values (core version, custom module/theme paths, and dependencies).

**Acceptance Scenarios**:

1. **Given** a valid Drupal project root with Drupal core and `composer.json`, **When** I start DriftCore and call `project_manifest`, **Then** I see `drupal_root`, `drupal_core_version`, `project_type`, `composer` (with `name` and `require`), `custom_modules`, and `custom_themes` that match the project on disk.
2. **Given** a Drupal project with no custom modules or themes, **When** I call `project_manifest`, **Then** `custom_modules` and `custom_themes` are present and empty arrays (not omitted).
3. **Given** a project where Composer metadata cannot be fully read, **When** I call `project_manifest`, **Then** I receive a valid response with a `composer` field that clearly indicates which data is unavailable instead of crashing or returning malformed JSON.

---

### User Story 2 - Inspect project state via Drush and Composer (Priority: P2)

As a Drupal developer, I can use DriftCore MCP tools to run safe, whitelisted Drush and Composer commands (status, module/theme lists, manifest, outdated) and receive predictable structured results so that I can understand project health and dependencies without running shell commands manually.

**Why this priority**: Once project context is available, inspection tools are the main way agents validate assumptions (modules enabled, versions, outdated packages) and plan future work. They must be safe, read only, and consistent.

**Independent Test**: With DriftCore pointed at a Drupal project, call each tool (`drift.drush_status`, `drift.drush_pml`, `drift.composer_info`, `drift.composer_outdated`) from an MCP client and verify that the returned JSON-style structures match the output of the underlying CLI commands and never modify the project.

**Acceptance Scenarios**:

1. **Given** a valid project and working Drush, **When** I call `drift.drush_status`, **Then** I receive a structured object including at least `drupal_version`, `php_version`, `database_driver`, `site_path`, and a details map, and **And** no project files are modified.
2. **Given** a valid project, **When** I call `drift.drush_pml`, **Then** I receive `modules` and `themes` arrays with `name`, `type` (core/contrib/custom/unknown), and `status` (enabled/disabled), and the tool does not accept arbitrary Drush flags from the client.
3. **Given** a valid project, **When** I call `drift.composer_info`, **Then** I receive a structured `manifest` (with `name` and `require`) and optional `lock_summary`, and Composer files on disk remain unchanged.
4. **Given** a valid project, **When** I call `drift.composer_outdated`, **Then** I receive an array of packages with `name`, `current_version`, `latest_version`, and status, and the command is executed from the configured project root without changing any dependencies.

---

### User Story 3 - Robust error handling and simple MCP integration (Priority: P3)

As a Drupal developer using an MCP-compatible client, I can configure DriftCore against a project and see clear, structured error responses whenever Drush or Composer fail so that I can diagnose configuration problems without the server crashing or hanging.

**Why this priority**: In real projects, Drush or Composer may be missing, misconfigured, or slow. Agents and humans must be able to handle these failures gracefully through structured responses instead of brittle text parsing or opaque crashes.

**Independent Test**: Misconfigure Drush or Composer (or point DriftCore at an invalid project root), call each tool and `project_manifest`, and verify that the MCP client receives structured `status` and `error` fields describing what went wrong while the server remains responsive.

**Acceptance Scenarios**:

1. **Given** an invalid Drupal root in configuration, **When** I start DriftCore or call `project_manifest`, **Then** I receive a clear, human-readable error description and a machine-readable error object, and the MCP server either refuses to start cleanly or enters a degraded but stable mode.
2. **Given** Drush is not installed or not runnable, **When** I call `drift.drush_status` or `drift.drush_pml`, **Then** I receive a structured error that explicitly states Drush is unavailable or misconfigured, and the MCP server remains up.
3. **Given** Composer is not installed or `composer outdated` times out, **When** I call `drift.composer_outdated`, **Then** I receive a structured `status` (for example, `timeout` or `error`) and an `error` object with a human-understandable message and diagnostics, and no dependency changes are attempted.

---

### Edge Cases

- What happens when the configured project root points to a directory that is not a Drupal installation?  
- How does the system behave when `composer.json` is missing but a Drupal core directory exists?  
- What happens when the Drush or Composer commands are present but return non-zero exit codes (for example, due to PHP errors or missing extensions)?  
- How does DriftCore handle large module/theme lists or long-running Composer commands without blocking the MCP server indefinitely?  
- What happens when the underlying project changes on disk (new custom modules/themes added) while DriftCore is running?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MCP server MUST represent exactly one Drupal project per running instance and MUST execute all underlying Drush and Composer commands from the configured project root directory.
- **FR-002**: The system MUST expose a `project_manifest` resource that returns `schema_version`, `drupal_root`, `drupal_core_version`, `project_type`, `composer` (with `name` and `require`), and arrays of `custom_modules` and `custom_themes` (present even when empty).
- **FR-003**: The system MUST provide read-only tools: `drift.drush_status`, `drift.drush_pml`, `drift.composer_info`, and `drift.composer_outdated`, each implemented as a fixed, whitelisted command that does not accept arbitrary flags or shell input from the client.
- **FR-004**: No v0.1 tool or resource MAY perform persistent write operations to the project’s code, configuration, or database; all operations are inspection-only.
- **FR-005**: All tool and resource responses MUST include a machine-readable `status` field and, on failure, a structured `error` object with at least a code and human-understandable message.
- **FR-006**: When Drush or Composer are unavailable, misconfigured, or return non-zero exit codes, the corresponding tools MUST return structured errors without crashing or terminating the MCP server.
- **FR-007**: The system MUST accept configuration that specifies the Drupal project root and optional overrides for Drush/Composer invocation, and it MUST either fail fast with clear configuration errors or apply documented defaults.
- **FR-008**: Each resource and tool MUST be documented (in repo docs) with purpose, inputs, outputs (schema), and usage examples that emphasize read-only, project-aware behavior.

### Key Entities *(include if feature involves data)*

- **Project Manifest**: Represents the current Drupal project context as seen from the configured root, including core version, Composer dependencies, and discovered custom modules/themes. Used by agents as the primary grounding resource.
- **Tool Result**: A structured response envelope for all tools and resources that includes `status`, optional `error`, and tool-specific payload fields (for example, Drush status values, module lists, Composer package details).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Drupal developer can configure DriftCore against an existing Drupal project, connect an MCP-compatible client, and successfully call `project_manifest`, `drift.drush_status`, `drift.drush_pml`, and `drift.composer_outdated` using only the provided documentation.
- **SC-002**: Automated tests verify that none of the v0.1 tools or resources perform persistent writes to the project’s code, configuration, or database when invoked under normal or error conditions.
- **SC-003**: In controlled failure scenarios (invalid project root, missing Drush, missing Composer, command timeouts), the MCP server remains responsive and returns structured `status` and `error` fields for 100% of tool calls.
- **SC-004**: For a sample Drupal project, the values returned by `project_manifest` and the Drush/Composer tools match the actual project state (core version, custom modules/themes, dependencies, outdated packages) within acceptable tolerances (for example, differences only where underlying tools disagree).

---

## API surface and schemas (normative)

This section formalizes the MCP-facing API for v0.1. All resources and tools MUST wrap their payloads in a common response envelope and MUST NOT accept arbitrary CLI flags or shell input.

### Response envelope

All resource and tool responses MUST conform to this envelope:

```jsonc
{
	"status": "ok" | "error" | "timeout" | "degraded" | "not_configured",
	"error"?: {
		"code": string,               // e.g., "E_DRUSH_NOT_FOUND", "E_TIMEOUT"
		"message": string,            // human-readable summary
		"details"?: object,           // tool-specific diagnostics (safe to surface)
		"exitCode"?: number,          // when a subprocess fails
		"stderr"?: string,            // redacted/truncated as needed
		"diagnostics"?: object        // timing, command name, cwd, paths used
	},
	"data"?: object                  // tool/resource-specific payload
}
```

Notes:

- On success, `status=ok` and `data` is present.
- On any failure, `status` is not `ok` and `error` is present; `data` MAY be omitted or partial (if partial, set `status=degraded`).

### Resource: project_manifest

Request: no parameters.

Response `data` schema:

```jsonc
{
	"schema_version": "0.1.0",
	"drupal_root": "<abs path>",                     // absolute path
	"drupal_core_version": "<string>" | null,        // null if unknown
	"project_type": "<string>" | null,               // e.g., "drupal-recommended-project"
	"composer": {
		"status": "ok" | "partial" | "missing",
		"name"?: "<string>",
		"require"?: { "<pkg>": "<version>" },
		"errors"?: [ { "code": "<string>", "message": "<string>" } ]
	},
	"custom_modules": [ { "name": "<string>", "path": "<string>" } ],
	"custom_themes": [ { "name": "<string>", "path": "<string>" } ]
}
```

Behavioral notes:

- `custom_modules` and `custom_themes` MUST be present even when empty.
- If Composer metadata cannot be fully read, set `composer.status` to `partial` or `missing` instead of failing the entire resource.

### Tool: drift.drush_status

Request: no parameters.

Response `data` schema:

```jsonc
{
	"drupal_version": "<string>" | null,
	"php_version": "<string>" | null,
	"database_driver": "<string>" | null,
	"site_path": "<string>" | null,
	"details": { "<key>": "<value>" }
}
```

### Tool: drift.drush_pml

Request: no parameters (no passthrough flags allowed).

Response `data` schema:

```jsonc
{
	"modules": [
		{
			"name": "<string>",
			"type": "core" | "contrib" | "custom" | "unknown",
			"status": "enabled" | "disabled"
		}
	],
	"themes": [
		{
			"name": "<string>",
			"type": "core" | "contrib" | "custom" | "unknown",
			"status": "enabled" | "disabled"
		}
	]
}
```

### Tool: drift.composer_info

Request: no parameters.

Response `data` schema:

```jsonc
{
	"manifest": {
		"name"?: "<string>",
		"require"?: { "<pkg>": "<version>" }
	},
	"lock_summary"?: {
		"packages"?: [
			{ "name": "<string>", "version": "<string>" }
		]
	}
}
```

### Tool: drift.composer_outdated

Request: no parameters.

Response `data` schema:

```jsonc
{
	"packages": [
		{
			"name": "<string>",
			"current_version": "<string>",
			"constraint"?: "<string>",             // from composer.json
			"latest_version": "<string>" | null,
			"latest_status": "semver-safe-update" | "update-possible" | "unknown",
			"package_type"?: "drupal-core" | "drupal-module" | "drupal-theme" | "library"
		}
	]
}
```

---

## Configuration (normative)

The server MUST accept configuration via JSON (exact file path documented in repo README). Keys and defaults:

```jsonc
{
	"drupalRoot": string,                                 // required; absolute path
	"drushPath"?: string,                                 // optional; absolute path to drush binary
	"composerPath"?: string,                              // optional; absolute path to composer binary
	"customModuleDirs"?: string[],                        // defaults: ["web/modules/custom", "modules/custom"]
	"customThemeDirs"?: string[],                         // defaults: ["web/themes/custom", "themes/custom"]
	"timeouts"?: {
		"drushStatusMs"?: number,                           // default 10000
		"drushPmlMs"?: number,                              // default 15000
		"composerInfoMs"?: number,                          // default 8000
		"composerOutdatedMs"?: number                       // default 30000
	},
	"maxParallelCli"?: 1,                                 // default 1 (serialize to avoid contention)
	"cacheTtlMs"?: {
		"projectManifest"?: number,                         // default 5000
		"pml"?: number                                      // default 5000
	}
}
```

Validation:
- `drupalRoot` MUST exist and be a directory; otherwise the server fails fast with `status=not_configured` for all calls and an `E_CONFIG_INVALID_ROOT` error.
- If `drushPath`/`composerPath` are unset, PATH discovery is attempted; failures yield tool-specific errors without terminating the server.

---

## Execution model and safety (normative)

- All CLI invocations MUST use spawned processes without a shell (no `sh -c`), passing fixed arguments only.
- CWD MUST be the configured `drupalRoot`.
- No tool accepts user-provided flags or arbitrary args in v0.1.
- Environment variables MUST be sanitized; only required values are inherited.
- The server MUST never perform persistent writes to code, config, or the database.
- On non-zero exit codes, return `status=error` and include `exitCode` and a redacted/truncated `stderr` when useful.

Concurrency:
- `maxParallelCli` defaults to 1. When >1, tools SHOULD queue to respect the limit; v0.1 MAY keep it at 1.

---

## Timeouts and long-running commands

Each tool MUST enforce a timeout (see configuration). On timeout:
- Kill the subprocess tree.
- Return `status=timeout` with error code `E_TIMEOUT` and elapsed time diagnostics.

---

## Caching and change detection

- `project_manifest` and `drift.drush_pml` MAY cache results for `cacheTtlMs` to reduce CLI load.
- Implement basic invalidation by tracking directory mtimes for custom module/theme roots when feasible. Manual refresh is achieved by simply waiting TTL; no cache-busting API is required in v0.1.

---

## Error response contract and codes

Common error codes (non-exhaustive):
- `E_CONFIG_INVALID_ROOT`
- `E_DRUSH_NOT_FOUND`
- `E_COMPOSER_NOT_FOUND`
- `E_CLI_NONZERO_EXIT`
- `E_TIMEOUT`
- `E_JSON_PARSE`
- `E_MANIFEST_INCOMPLETE`

All failures MUST return the response envelope with a populated `error` object. Resources MAY degrade (partial data) with `status=degraded` rather than hard-failing when safe and useful.

---

## Transports

v0.1 supports at least one MCP transport. The implementation in this repo provides:
- stdio (default)
- http on localhost (optional)

The chosen transport MUST be documented in the server package README with setup steps.

---

## Examples

project_manifest (success):

```json
{
	"status": "ok",
	"data": {
		"schema_version": "0.1.0",
		"drupal_root": "/path/to/project/web",
		"drupal_core_version": "10.3.5",
		"project_type": "drupal-recommended-project",
		"composer": {
			"status": "ok",
			"name": "acme/site",
			"require": { "drupal/core": "^10.3", "drupal/token": "^1.11" }
		},
		"custom_modules": [ { "name": "acme_blog", "path": "web/modules/custom/acme_blog" } ],
		"custom_themes": []
	}
}
```

drift.composer_outdated (timeout):

```json
{
	"status": "timeout",
	"error": {
		"code": "E_TIMEOUT",
		"message": "composer outdated exceeded 30000ms",
		"diagnostics": { "command": "composer outdated --format=json", "elapsedMs": 30012 }
	}
}
```

---

## Test plan additions

Augment the existing user scenarios with automated tests:

1. Contract tests for each resource/tool validating the envelope and schema (using JSON schema validation).
2. Snapshot tests comparing parsed outputs to golden files from known Drupal sandboxes (avoid exact version pinning when flaky).
3. Failure matrix:
	 - Invalid `drupalRoot` -> `not_configured` + `E_CONFIG_INVALID_ROOT`.
	 - Missing Drush -> `E_DRUSH_NOT_FOUND` for Drush tools only.
	 - Missing Composer -> `E_COMPOSER_NOT_FOUND` for Composer tools only.
	 - Non-zero exits (simulate PHP error) -> `E_CLI_NONZERO_EXIT` with `exitCode`.
	 - Timeouts -> `E_TIMEOUT` with elapsedMs.
4. Non-write verification: run tools and assert file mtimes under project root are unchanged.
5. Concurrency: when `maxParallelCli=1`, concurrent invocations queue and complete without overlap (assert ordering by timestamps in diagnostics).

---

## Non-functional requirements

- Logging: structured logs with level, tool, duration, status; exclude secrets; cap stderr length.
- Security: no shell invocation; fixed args only; sanitize env; validate paths; guard against path traversal when scanning custom dirs.
- Performance: default timeouts as configured; typical responses under 1s for `drush status` and `composer info` on a warm system.


