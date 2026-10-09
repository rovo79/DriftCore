# DriftCore

DriftCore gives an MCP client authoritative context about one local Drupal project and guarded tools for Drupal maintenance. The primary interface is **standard MCP STDIO** through the `driftcore` executable. The client launches it on demand; no daemon is needed.

## Install and connect

DriftCore requires Node.js 20 or newer and a local Drupal codebase. A standard Composer project can use `web/core`, `docroot/core`, or `core` at its project root. Drush and Composer are needed for tools that run those binaries, but filesystem-based inspection can work without a live database.

When `@driftcore/server` is published to npm, an MCP client can use this configuration:

```json
{
  "mcpServers": {
    "driftcore": {
      "command": "npx",
      "args": [
        "-y",
        "@driftcore/server",
        "--project-root",
        "/absolute/path/to/drupal-project"
      ]
    }
  }
}
```

**Current local installation:** The package has not been published. From a DriftCore checkout, `npm --prefix packages/server ci` followed by `npm --prefix packages/server pack` creates `packages/server/driftcore-server-0.2.0.tgz`. Install that tarball in a separate consumer project and point the MCP client at the installed executable:

```sh
npm install /absolute/path/to/DriftCore/packages/server/driftcore-server-0.2.0.tgz
```

```json
{
  "mcpServers": {
    "driftcore": {
      "command": "/absolute/path/to/consumer/node_modules/.bin/driftcore",
      "args": ["--project-root", "/absolute/path/to/drupal-project"]
    }
  }
}
```

The `--project-root` argument is the Composer project root, not its nested `web` or `docroot` directory. The tarball route is proven by the packed consumer integration test. The published `npx` example describes the intended install once publication occurs.

## Project selection

The CLI accepts `--project-root <path>` and `--config <path>`. Selection order is:

1. Explicit `--project-root`. With `--config`, it overrides that file's `drupalRoot` while retaining other settings. By itself, it ignores config files and `DRIFTCORE_CONFIG`.
2. Explicit `--config` file.
3. File named by `DRIFTCORE_CONFIG`.
4. `driftcore.config.json` in the current working directory.
5. Upward project discovery from the current working directory using Drupal Composer metadata or conventional core directories.

DriftCore derives the Drupal root from `<projectRoot>/web/core`, then `docroot/core`, then `core`. Explicit legacy config files instead provide `drupalRoot` directly. An invalid selected path fails startup with a stderr diagnostic. Standard MCP stdout contains protocol traffic only.

## MCP resources

| URI | Project data |
| --- | --- |
| `driftcore://project/manifest` | Root, core version, Composer metadata, custom extensions and capabilities |
| `driftcore://project/modules` | Module and theme discovery |
| `driftcore://project/config-layout` | Configuration sync and environment layout |
| `driftcore://project/checks` | Project readiness, binary availability and warnings |

These four resources are connected-project facts. The static `schema.entityTypes` and `config.exported` templates belong only to the legacy catalog; they are not exposed as standard MCP resources.

## MCP tools

| Inspection and assessment | Guarded workflows |
| --- | --- |
| `drift_drush_status` | `drift_cache_rebuild_preview` |
| `drift_drush_pml` | `drift_cache_rebuild_apply` |
| `drift_composer_info` | `drift_cache_rebuild_verify` |
| `drift_composer_outdated` | `drift_module_scaffold_preview` |
| `drift_upgrade_assessment` | `drift_module_scaffold_apply` |
| `drift_config_drift_assessment` | `drift_module_scaffold_verify` |
| `drift_scaffold_plan` | `drift_config_export_preview` |
| | `drift_config_export_apply` |
| | `drift_config_export_verify` |

Inspection, assessment, cache rebuild preview/verify, and config export preview/verify accept an empty object. `drift_scaffold_plan`, `drift_module_scaffold_preview`, and `drift_module_scaffold_verify` require `machine_name` (1–64 characters, lowercase letter first, then lowercase letters, numbers, or underscores) and `target_type: "module"`. The cache rebuild and config export apply tools require a nonempty `preview_token`; module scaffold apply requires that token plus the scaffold fields. Inputs are strict: extra properties are rejected.

A write operation uses **preview → apply → verify**. Preview returns the intended operation and a short-lived token. Apply requires and consumes that token. Verify checks the resulting state. The tools invoke fixed Drush/Composer operations, with no arbitrary shell command input. Tool results contain a JSON text envelope and structured content with `status`, optional `data` or `error`; `error` and `timeout` statuses set the MCP error flag.

## Legacy compatibility

The **Legacy REST API** uses route-per-operation HTTP, not Streamable HTTP MCP. The **Legacy DriftCore action-STDIO** protocol accepts one custom JSON action per line, such as `{"id":1,"action":"project_manifest"}`. Both remain available through `start:http:legacy` and `start:stdio:legacy`, and both use legacy config-file selection. They are covered by compatibility tests. See [the transport decision](docs/decisions/standard-mcp-stdio.md) for removal criteria.

The REST listener defaults to `127.0.0.1`; it has no authentication and should remain a trusted local interface. The standard MCP executable is the recommended integration path.

## Contributing from source

The runtime package is in [`packages/server`](packages/server). From the repository root:

```sh
npm --prefix packages/server ci
npm --prefix packages/server run lint
npm --prefix packages/server run build
npm --prefix packages/server test
npm --prefix packages/server run integration
npm --prefix packages/server run pack:check
npm --prefix packages/server run integration:mcp
```

`integration` checks legacy REST. `integration:mcp` installs a fresh tarball into a temporary consumer and checks a real SDK client's MCP session. Detailed commands and architecture are under [`docs/ai`](docs/ai), and the package's [README](packages/server/README.md) travels with the tarball. Final MCP Inspector and real-project acceptance remain to be completed.

## Scope

DriftCore operates on Drupal project configuration and engineering workflows. It does not expose Drupal content entities or implement Drupal runtime permissions. A separate runner, general sandbox, generated SDK, Streamable HTTP, and DDEV/Lando execution backends are deferred.

## License

MIT. The package includes a license file.
