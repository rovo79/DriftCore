# @driftcore/server

DriftCore is a single-project Drupal MCP server. The `driftcore` executable speaks standard MCP over STDIO and exposes four authoritative resources and sixteen tools. A client starts the process when needed. Requires Node.js 20 or newer.

## Client installation

Once this package is published, a client can launch it with `npx -y @driftcore/server --project-root /absolute/path/to/drupal-project`. **It is not published yet.** The working local route is a tarball:

```sh
npm ci
npm pack
```

Run those two commands from this package's source directory. They create `driftcore-server-0.2.0.tgz`. From a separate consumer project, install the resulting absolute path:

```sh
npm install /absolute/path/to/driftcore-server-0.2.0.tgz
```

Point an MCP client at the consumer's installed executable:

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

This installed-tarball path is exercised by `integration:mcp`. `npm run` is for source development; npm's banners must not enter a client's MCP stdout stream.

## Project selection and configuration

`--project-root` names the Composer project root. DriftCore selects `<root>/web`, `<root>/docroot`, or `<root>` based on which contains `core`. The next choices are `--config`, `DRIFTCORE_CONFIG`, `driftcore.config.json` in the working directory, and upward discovery from the working directory. With both CLI flags, `--project-root` overrides only the config file's `drupalRoot`. With only `--project-root`, environment and CWD config files are ignored. Invalid selected paths fail startup.

A legacy config can name the Drupal root and optional binary paths/settings directly:

```json
{
  "drupalRoot": "/absolute/path/to/project/web",
  "drushPath": "/absolute/path/to/project/vendor/bin/drush",
  "composerPath": "/absolute/path/to/composer",
  "maxParallelCli": 1
}
```

Use `--help` to see CLI flags. Help and diagnostic logs go to stderr; standard MCP stdout is reserved for protocol traffic.

## MCP surface and safety

The four resource URIs are:

- `driftcore://project/manifest`
- `driftcore://project/modules`
- `driftcore://project/config-layout`
- `driftcore://project/checks`

The seven inspection and assessment tools are:

- `drift_drush_status`
- `drift_drush_pml`
- `drift_composer_info`
- `drift_composer_outdated`
- `drift_upgrade_assessment`
- `drift_config_drift_assessment`
- `drift_scaffold_plan`

The nine guarded tools are:

- `drift_cache_rebuild_preview`, `drift_cache_rebuild_apply`, `drift_cache_rebuild_verify`
- `drift_module_scaffold_preview`, `drift_module_scaffold_apply`, `drift_module_scaffold_verify`
- `drift_config_export_preview`, `drift_config_export_apply`, `drift_config_export_verify`

The scaffold plan, preview and verify tools require `machine_name` (lowercase letter first; then lowercase letters, digits or underscores; 1–64 characters) and `target_type: "module"`. Module scaffold apply additionally requires `preview_token`. Cache rebuild and config export apply require only a nonempty `preview_token`. All other MCP tools take an empty object, and all input objects reject unknown keys.

Apply requires a short-lived, single-use preview token. Module scaffold accepts only `target_type: "module"` and a lowercase/underscore machine name. Tools use bounded, fixed CLI invocations and return structured status envelopes.

## Legacy compatibility

From the source package directory, existing custom interfaces remain available:

```sh
DRIFTCORE_CONFIG=/absolute/path/to/config.json npm run start:stdio:legacy
DRIFTCORE_CONFIG=/absolute/path/to/config.json npm run start:http:legacy -- --port 8080
```

The first accepts JSON lines such as `{"id":1,"action":"project_manifest"}`. The second serves the route-per-operation REST API on `127.0.0.1` by default. These are Legacy DriftCore action-STDIO and Legacy REST API, respectively; neither is a standard MCP HTTP service.

## Contributing from source

```sh
npm ci
npm run lint
npm run build
npm test
npm run integration
npm run pack:check
npm run integration:mcp
```

`start` and `start:mcp` both launch standard MCP STDIO. `integration` checks legacy REST; `integration:mcp` proves the packed executable works in a temporary clean consumer. The architecture decision and removal criteria are at https://github.com/rovo79/DriftCore/blob/feat/standard-mcp-stdio/docs/decisions/standard-mcp-stdio.md.

## License

MIT. See the included `LICENSE` file.
