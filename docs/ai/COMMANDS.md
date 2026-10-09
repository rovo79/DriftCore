# Commands

## MCP client installation

The published package example in the [root README](../../README.md) uses `npx`. Publication has not occurred. For a local tarball, run the following from the repository root, then install the generated `packages/server/driftcore-server-0.2.0.tgz` in a consumer project:

```sh
npm --prefix packages/server ci
npm --prefix packages/server pack
```

The consumer's MCP client launches `/absolute/path/to/consumer/node_modules/.bin/driftcore` with `--project-root /absolute/path/to/drupal-project`. Alternatively pass `--config /absolute/path/to/driftcore.config.json`. Standard MCP runs over STDIO and does not need a daemon.

## Contributing from source

The commands below run from the repository root. `npm --prefix packages/server` targets the only runtime package; there is no root `package.json` script wrapper.

```sh
npm --prefix packages/server run build
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run integration
npm --prefix packages/server run pack:check
npm --prefix packages/server run integration:mcp
```

`build` cleans `dist` and compiles. `integration` runs the Legacy REST API smoke test. `integration:mcp` packs a tarball, installs it in an isolated consumer, exercises resources/tools through an SDK client, and removes the temporary files.

## Source launch and legacy compatibility

```sh
npm --prefix packages/server run start -- --project-root /absolute/path/to/drupal-project
npm --prefix packages/server run start:mcp -- --project-root /absolute/path/to/drupal-project
DRIFTCORE_CONFIG=/absolute/path/to/driftcore.config.json npm --prefix packages/server run start:stdio:legacy
DRIFTCORE_CONFIG=/absolute/path/to/driftcore.config.json npm --prefix packages/server run start:http:legacy -- --port 8080
```

`start` and `start:mcp` run Standard MCP STDIO. The legacy STDIO command accepts `{"id":1,"action":"project_manifest"}` JSON lines. The legacy HTTP command starts the REST routes on `127.0.0.1` by default. The names `start:stdio` and `start:http` are retired.

## Docker image

The package Dockerfile currently starts the Legacy REST API using `node dist/bin/http.js`. This is an existing compatibility deployment, not a standard MCP HTTP service. The project and config paths must be accessible inside the container.
