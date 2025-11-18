# @driftcore/server

Baseline MCP server that connects to a single Drupal project and exposes read-only resources and tools (Drush and Composer) for external agents.

## Requirements

- Node.js 20+
- npm 9+
- A Drupal codebase checked out locally (for example `/Users/rob/Dev/drupal`)
- Drush and Composer installed (the project’s `vendor/bin` copies work fine)

## Installation

```bash
cd packages/server
npm install
```

## Configuration

Create a JSON configuration file and point `DRIFTCORE_CONFIG` at it. Example:

`/Users/rob/Dev/DriftCore/driftcore.config.json`

```jsonc
{
  "drupalRoot": "/Users/rob/Dev/drupal/web",
  "drushPath": "/Users/rob/Dev/drupal/vendor/bin/drush",
  "composerPath": "/usr/local/bin/composer",
  "customModuleDirs": ["web/modules/custom"],
  "customThemeDirs": ["web/themes/custom"],
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
  }
}
```

`drupalRoot` must exist and point to the Drupal installation root (`web/`). If omitted or invalid, every resource/tool reports `status="not_configured"` with `E_CONFIG_INVALID_ROOT`.

## Running the server

### STDIO transport

```bash
cd packages/server
DRIFTCORE_CONFIG=/path/to/driftcore.config.json npm run start:stdio
```

The stdio transport accepts JSON commands such as:

```json
{"id":1,"action":"project_manifest"}
```

### HTTP transport

```bash
cd packages/server
DRIFTCORE_CONFIG=/path/to/driftcore.config.json npm run start:http -- --port 8080
```

Endpoints (all `GET`):

- `/health`
- `/resources`
- `/tools`
- `/project-manifest`
- `/drush/status`
- `/drush/pml`
- `/composer/info`
- `/composer/outdated`

Each returns the shared response envelope (`status`, optional `data`, optional `error` with `code` and `message`).

## Available tools/resources

- `project_manifest` resource summarizing Drupal root, core version, Composer dependencies, custom modules/themes.
- Tools:
  - `drift.drush_status`
  - `drift.drush_pml`
  - `drift.composer_info`
  - `drift.composer_outdated`

All tools run from the configured `drupalRoot` with fixed arguments, obey per-tool timeouts, enforce `maxParallelCli`, and never mutate project files.

## Testing

```bash
cd packages/server
npm test        # Builds and runs node --test suites.
npm run build   # Type-checks and emits dist/
npm run integration   # Runs the HTTP transport smoke test
```

The test suite covers schema resources, project manifest discovery, Drush/Composer tool parsing, and non-write guarantees. The integration smoke test exercises the HTTP transport endpoints.

