# CONVENTIONS

- **Language and module conventions**
  - TypeScript ESM imports with explicit `.js` extensions in local imports.
  - Strict TypeScript enabled (`"strict": true`).
- **Error/response conventions**
  - Feature methods return structured envelopes with `status`, optional `data`, optional `error`.
  - Config and CLI failures use explicit code strings (e.g., `E_CONFIG_INVALID_ROOT`, `E_JSON_PARSE`, `E_TIMEOUT`).
  - CLI stderr is truncated before being returned.
- **Tooling conventions**
  - Read-only by design in v0.1 tooling: fixed command args for Drush/Composer tools.
  - No shell interpolation (`spawn(..., shell: false)`).
- **Configuration conventions**
  - Config source precedence: explicit path -> `DRIFTCORE_CONFIG` env -> `./driftcore.config.json`.
  - Defaults provided for module/theme dirs, timeouts, cache TTL, and CLI concurrency.
- **Testing conventions**
  - Uses `node:test` and `assert/strict`.
  - Tests create temporary fake Drupal projects in OS temp dirs.
  - Includes a dedicated non-write behavior test.
- **Documentation/process conventions**
  - RFC/spec docs exist and describe intended behavior, but implementation may lag roadmap content.
  - Package README documents operational commands and expected config structure.

## Assumptions

- No external formatter/linter config (ESLint/Prettier) is currently checked in, so style conventions are inferred from source.
- Naming and error code patterns are inferred from current server package and may evolve.
