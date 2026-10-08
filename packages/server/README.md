# @driftcore/server

DriftCore connects an MCP client to one local Drupal project. The standard MCP
STDIO server exposes four project resources, seven read-only tools, and nine
guarded preview/apply/verify tools. The MCP client owns the process lifecycle.

## Requirements

- Node.js 20 or newer and npm.
- A local Drupal codebase containing `web/core`, `docroot/core`, or `core`.
- Drush and Composer for tools that execute those binaries. Filesystem metadata
  inspection does not need a running database or those binaries.

## Local packaged installation

This package has not been published to npm. Build a local tarball from the source:

```sh
npm ci
npm pack
```

Install that tarball in your consumer project:

```sh
npm install /absolute/path/to/driftcore-server-0.2.0.tgz
```

Configure your MCP client to launch the installed executable directly (avoid
`npm run` for MCP clients, since npm's script banners can write to stdout):

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

## Project selection

`--project-root` accepts the Composer project root, not the nested Drupal root.
DriftCore derives the Drupal root in order: `web/core`, `docroot/core`, then `core`.
Without the flag, it resolves `--config`, then `DRIFTCORE_CONFIG`, then
`driftcore.config.json` in the current working directory, then searches upward
for Drupal Composer metadata or conventional Drupal directories.

Missing or invalid selected configuration fails startup instead of falling back.
MCP startup also fails when no usable Drupal root is found. All operational logs
and help output use stderr; stdout contains only MCP protocol messages.

Legacy configuration files still accept `drupalRoot` directly:

```json
{
  "drupalRoot": "/absolute/path/to/project/web",
  "drushPath": "/absolute/path/to/project/vendor/bin/drush",
  "composerPath": "/usr/local/bin/composer",
  "maxParallelCli": 1
}
```

When both flags are given, `--project-root` overrides the config's Drupal root
while retaining its other settings. With only `--project-root`, environment and
CWD config files are ignored.

## Legacy compatibility

The existing REST HTTP and custom action-STDIO transports remain available:

```sh
DRIFTCORE_CONFIG=/absolute/path/to/config.json npm run start:stdio:legacy
DRIFTCORE_CONFIG=/absolute/path/to/config.json npm run start:http -- --port 8080
```

The legacy STDIO protocol accepts action messages such as
`{"id":1,"action":"project_manifest"}`. It is not standard MCP. Legacy transports
continue to use config files and their existing response envelopes.

## Source development and verification

```sh
npm ci
npm run lint
npm run build
npm test
npm run integration
npm run pack:check
npm run integration:mcp
```

`start` and `start:mcp` run the standard MCP entry point. `integration` checks
legacy HTTP. `integration:mcp` packs the package, installs it in an isolated
consumer, and uses a real SDK client against the installed executable. It checks
initialization, resources, tools, metadata reads, a read-only call, protocol-only
stdout, and clean EOF shutdown. Temporary files are removed on success or failure.

## License

MIT. See the included LICENSE file.
