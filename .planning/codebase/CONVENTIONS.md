# Coding Conventions

**Analysis Date:** 2026-02-12

## Naming Patterns

**Files:**
- TypeScript sources: `*.ts` in `packages/server/src/`
- Feature modules: camelCase filenames in `packages/server/src/features/` (for example `projectManifest.ts`, `sandboxExecution.ts`)
- Tests: `*.test.ts` (and one `*.nonwrite.test.ts`) in `packages/server/src/__tests__/`

**Functions:**
- camelCase for functions (for example `createMCPServer()`, `loadServerConfig()`, `runCliCommand()`) in `packages/server/src/`
- Async functions use `async`/`await` (no naming prefix) - examples throughout `packages/server/src/features/`

**Variables:**
- camelCase for variables
- UPPER_SNAKE_CASE for constants - for example `MAX_STDERR_LENGTH` in `packages/server/src/features/errorMapping.ts`

**Types:**
- PascalCase for interfaces and types - for example `ServerState`, `ResourceOrToolResponse` in `packages/server/src/types.ts`

## Code Style

**Formatting:**
- No repo-level Prettier/ESLint config found; formatting conventions inferred from source.
- Indentation appears to be 2 spaces (for example `packages/server/src/index.ts`).
- Strings use double quotes (for example `packages/server/src/transports/http.ts`).
- Semicolons used consistently.

**Linting:**
- Type-checking is treated as lint: `tsc --noEmit` in `packages/server/package.json` (`npm run lint`).

## Import Organization

**Order (common pattern):**
1. Node built-ins (often with `node:` prefix) - for example `packages/server/src/index.ts`
2. Internal relative imports - for example `packages/server/src/transports/http.ts`

**ESM import detail:**
- Local imports include explicit `.js` extensions in TypeScript (compiled output expects `.js`):
  - Example: `packages/server/src/index.ts` imports `./transports/stdio.js` and `./transports/http.js`.

## Error Handling

**Patterns:**
- Prefer returning structured response envelopes for expected failures (config missing, CLI non-zero exit, JSON parse errors).
  - Response envelope type: `ResourceOrToolResponse<T>` in `packages/server/src/types.ts`.
- Normalize CLI execution failures via helper:
  - `mapCliResultToError()` in `packages/server/src/features/errorMapping.ts`.
- Truncate stderr before returning:
  - `truncateStderr()` in `packages/server/src/features/errorMapping.ts`.

**Error Codes:**
- String error codes are used throughout (for example `E_CONFIG_INVALID_ROOT`, `E_JSON_PARSE`, `E_TIMEOUT`).
  - Config errors: `packages/server/src/config.ts`
  - CLI parsing/execution errors: `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`

## Logging

**Framework:**
- Uses injected `logger` with `console` default.
  - Operation timing/status logging wrapper: `packages/server/src/index.ts`.

**Patterns:**
- Uses optional chaining on logger methods to tolerate partial console implementations:
  - Example: `logger.warn?.(...)` in `packages/server/src/index.ts`.
- Logs transport activity:
  - Example: `state.logger.info?.(\`HTTP ${req.method} ${req.url}\`)` in `packages/server/src/transports/http.ts`.

## Comments

**When to Comment:**
- TODO markers for planned features exist in stub modules:
  - `packages/server/src/features/sandboxExecution.ts` (`executeInSandbox` TODO)
  - `packages/server/src/features/sdkGeneration.ts`

## Function Design

**Parameters:**
- Often uses options objects (for example `loadServerConfig(options)` in `packages/server/src/config.ts`).

**Return Values:**
- Feature APIs return explicit typed objects, not exceptions, for expected error paths.

## Module Design

**Exports:**
- Named exports for functions/types.
- Types are frequently re-exported with `export type { ... }` (for example `packages/server/src/index.ts`).

---

*Convention analysis: 2026-02-12*
*Update when patterns change*
