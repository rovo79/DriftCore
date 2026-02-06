# STACK

- **Language/runtime**
  - TypeScript 5.x compiled to ESM JavaScript.
  - Node.js 20+ runtime target.
- **Package/dependency management**
  - `npm` for install/build/test in the implemented package.
  - Single implemented package currently visible: `@driftcore/server`.
- **Core dependencies**
  - `yargs` for CLI argument parsing (`--port` in HTTP entrypoint).
  - Node standard library heavily used (`http`, `readline`, `child_process`, `fs`, `path`, `process`, `assert`, `node:test`).
- **Build and type-checking**
  - TypeScript compiler (`tsc`) via `npm run build` and `npm run lint` (`--noEmit`).
  - Output directory: `packages/server/dist`.
- **Testing stack**
  - Built-in Node test runner (`node --test`) for unit tests.
  - Integration smoke script hitting HTTP endpoints.
- **Runtime interfaces**
  - STDIO line-based JSON protocol.
  - HTTP GET endpoints.
- **Containerization**
  - Dockerfile for server package based on `node:20-slim`; installs deps, builds TS, runs HTTP binary.
- **Drupal/tooling integration points**
  - Executes Drush and Composer via child processes with fixed args and timeout/concurrency controls.
  - Configurable binary paths and Drupal root via JSON config.

## Assumptions

- No root workspace manifest is present; stack details are inferred from `packages/server` and docs.
- No alternative package managers/scripts are configured in code beyond references in README text.
