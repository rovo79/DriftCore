# DEPLOYMENT

- **Current deployment maturity**
  - Repository contains a package-level Dockerfile for `@driftcore/server`.
  - No checked-in CI/CD workflow or orchestrator manifests are present.

## What exists now

- `packages/server/Dockerfile`
  - Base: `node:20-slim`
  - Copies `package.json`, `tsconfig.json`, `src/`
  - Runs `npm install && npm run build`
  - Starts HTTP server: `node dist/bin/http.js`
- Runtime requires external config via `DRIFTCORE_CONFIG` (or default file path in working dir).

## Minimal deployment pattern

- Build the server image from `packages/server`.
- Provide `driftcore.config.json` at runtime (bind mount or baked image layer).
- Ensure target Drupal codebase and CLI binaries are reachable from runtime:
  - `drupalRoot` path must be valid inside container.
  - Drush and Composer paths must be valid (or discoverable defaults must exist).
- Expose HTTP port (default 8080) when using HTTP transport.

## Operational considerations

- Health probe can call `/health`.
- Since endpoints are GET and mostly inspection-oriented, deployment is stateless apart from in-memory cache.
- Logs are console-based; operation timing/status is emitted from server operation wrapper.

## Unknowns / confirmation files if needed

- CI/CD pipeline details: would need `.github/workflows/*` or external build system config.
- Kubernetes/Compose production topology: would need deployment manifests (not present).
- Secret management strategy: would need env/config management docs outside current repo.

## Assumptions

- Deployment guidance is based on what is checked into the repository only.
- No production hardening (auth/TLS/reverse proxy) is inferred unless configured externally.
