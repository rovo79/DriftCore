# Technology Stack

**Analysis Date:** 2026-02-12

## Languages

**Primary:**
- TypeScript (strict) - Runtime code in `packages/server/src/` (compiled to `packages/server/dist/`)

**Secondary:**
- JavaScript (ESM) - Build output executed by Node.js (for example `packages/server/dist/bin/http.js`)
- Markdown - Documentation and specs in `README.md`, `docs/ai/`, `rfcs/`, `specs/`

## Runtime

**Environment:**
- Node.js 20+ - Required by `packages/server/README.md` and CI uses Node 20 in `.github/workflows/ci.yml`
- ESM modules - `"type": "module"` in `packages/server/package.json`

**Package Manager:**
- npm - Used by CI and package scripts (`.github/workflows/ci.yml`, `packages/server/package.json`)
- Lockfiles:
  - `packages/server/package-lock.json` (lockfileVersion 3)
  - `packages/agent-runner/package-lock.json` (lockfileVersion 3)

## Frameworks

**Core:**
- Node.js built-in HTTP server - `packages/server/src/index.ts`, `packages/server/src/transports/http.ts`
- Line-based JSON over stdin/stdout (custom "MCP-style" protocol) - `packages/server/src/transports/stdio.ts`

**Testing:**
- Node built-in test runner (`node:test`) - tests in `packages/server/src/__tests__/` executed via `node --test dist/__tests__` in `packages/server/package.json`
- Assertions: `node:assert/strict` - for example `packages/server/src/__tests__/cliTools.test.ts`

**Build/Dev:**
- TypeScript compiler (`tsc`) - `packages/server/package.json` scripts; config in `packages/server/tsconfig.json`

## Key Dependencies

**Critical:**
- `yargs` 17.7.2 - CLI argument parsing for HTTP entrypoint in `packages/server/src/bin/http.ts`
- `typescript` (devDependency) - constraint `^5.3.3` in `packages/server/package.json` (resolved to 5.9.3 in `packages/server/package-lock.json`)
- `@types/node` (devDependency) - constraint `^20.11.0` in `packages/server/package.json` (resolved to 20.19.25 in `packages/server/package-lock.json`)

**Infrastructure:**
- Node standard library heavily used (`node:http`, `node:readline`, `node:child_process`, `node:fs`, `node:path`, `node:test`) across `packages/server/src/`

## Configuration

**Environment:**
- Config path precedence (loader):
  1. Explicit `configPath` option to `createMCPServer()` (`packages/server/src/types.ts`, `packages/server/src/index.ts`)
  2. `DRIFTCORE_CONFIG` env var (`packages/server/src/config.ts`)
  3. Default `./driftcore.config.json` in current working directory (`packages/server/src/config.ts`)
- Notable env vars:
  - `DRIFTCORE_CONFIG` - path to JSON configuration file (`packages/server/src/config.ts`, `packages/server/README.md`)
  - `COMPOSER_MEMORY_LIMIT` - forwarded when running `composer outdated` (`packages/server/src/features/composerTools.ts`)

**Build:**
- `packages/server/tsconfig.json` - `rootDir: "src"`, `outDir: "dist"`
- `packages/server/Dockerfile` - container build (Node 20 image)

## Platform Requirements

**Development:**
- Node.js 20+ and npm (CI uses Node 20 in `.github/workflows/ci.yml`)
- For meaningful runtime behavior, a local Drupal codebase and CLI tooling available on the same machine/container:
  - Drupal root path configured as `drupalRoot` (must exist) - validated in `packages/server/src/config.ts`
  - Drush executable (configured or discoverable) - resolved in `packages/server/src/features/drushTools.ts`
  - Composer executable (configured or discoverable) - resolved in `packages/server/src/features/composerTools.ts`

**Production:**
- Runs as a Node process via one of the transport binaries:
  - HTTP: `packages/server/src/bin/http.ts` (compiled to `packages/server/dist/bin/http.js`)
  - STDIO: `packages/server/src/bin/stdio.ts` (compiled to `packages/server/dist/bin/stdio.js`)
- Docker image available for HTTP transport by default - `packages/server/Dockerfile`

---

*Stack analysis: 2026-02-12*
*Update after major dependency changes*
