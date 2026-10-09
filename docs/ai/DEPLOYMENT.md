# Deployment

## Primary local MCP path

An MCP client starts the installed `driftcore` executable on demand with `--project-root /absolute/path/to/drupal-project`. Node.js 20 or newer is required. The client owns the process lifetime; stdin/stdout carry standard MCP messages, and diagnostics go to stderr. There is no separate daemon or listening port.

The package is not published yet. The tested route is a local `npm pack` tarball installed into a clean consumer, as described in the [root README](../../README.md). Publication to npm and the MCP Registry is deferred. The tarball includes compiled runtime code, package metadata, README, and license; compiled tests and integration harnesses are excluded.

Drush and Composer are required for operations that invoke them. Ensure the selected Drupal codebase and project-local executables are reachable by the client process. A missing binary can degrade or fail an operation, while filesystem-based project inspection may still work.

## Existing container path: Legacy REST API

`packages/server/Dockerfile` uses `node:20-slim`, copies package metadata, TypeScript config and source, installs dependencies, builds, then starts `node dist/bin/http.js`. The container must mount a reachable Drupal project and a config file whose `drupalRoot` is valid inside that container. It serves the route-per-operation Legacy REST API on port 8080 by default, bound to `127.0.0.1` unless configured otherwise. A container port mapping alone does not change the listener binding.

This REST API is not Streamable HTTP MCP. It has no authentication. Treat it as local-only unless an independently designed authenticated deployment is added. The Legacy DriftCore action-STDIO adapter remains available through `start:stdio:legacy` for existing consumers.

## Operational checks

The REST `/health` route reports configuration, binary availability and capability flags. It is not an MCP health endpoint. Operation timing/status logs come from the shared server state. The repository has a GitHub Actions CI workflow for lint, build and unit tests; the HTTP and packed consumer integrations are run locally for this migration. No Kubernetes/Compose production topology or remote authorization system is defined here.
