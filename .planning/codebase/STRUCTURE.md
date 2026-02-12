# Codebase Structure

**Analysis Date:** 2026-02-12

## Directory Layout

```
DriftCore/
├── .agents/                 # Local agent/tooling metadata
├── .codex/                  # Local tooling directory (gitignored)
├── .docs/                   # Local tooling directory (gitignored)
├── .github/                 # GitHub Actions workflows
│   └── workflows/           # CI pipeline definitions
├── .specify/                # Local tooling directory (gitignored)
├── docs/                    # Repository docs
│   └── ai/                  # Internal AI-oriented repo docs (codebase map, stack, testing, etc.)
├── packages/                # Node packages
│   ├── agent-runner/        # Placeholder package (no runtime implementation)
│   └── server/              # Main runtime implementation (@driftcore/server)
├── rfcs/                    # Architecture/product RFCs
├── specs/                   # Product specs (acceptance criteria, tasks)
├── AGENTS.md                # Guidance for external agents consuming DriftCore
├── README.md                # Project overview
└── Updated_Strategy.md      # Project notes/strategy
```

## Directory Purposes

**packages/server/**
- Purpose: MCP-style server implementation.
- Contains: TypeScript source, tests, Dockerfile, package scripts.
- Key files:
  - `packages/server/package.json` - scripts and dependencies
  - `packages/server/tsconfig.json` - TypeScript build config
  - `packages/server/src/index.ts` - composition root (`createMCPServer()`)
  - `packages/server/src/bin/http.ts` - HTTP entrypoint
  - `packages/server/src/bin/stdio.ts` - STDIO entrypoint
  - `packages/server/src/transports/http.ts` - HTTP routing
  - `packages/server/src/transports/stdio.ts` - STDIO routing
  - `packages/server/src/features/` - tool/resource feature logic
  - `packages/server/src/__tests__/` - unit tests
  - `packages/server/src/integration/smoke.ts` - HTTP smoke test
  - `packages/server/Dockerfile` - container build

**packages/agent-runner/**
- Purpose: Placeholder so CI `npm install --prefix packages/agent-runner` does not fail.
- Contains: Minimal `package.json` and `package-lock.json`.
- Key files: `packages/agent-runner/package.json`, `packages/agent-runner/README.md`.

**docs/ai/**
- Purpose: AI-oriented documentation (stack, architecture, testing, commands, risks).
- Key files: `docs/ai/CODEBASE_MAP.md`, `docs/ai/STACK.md`, `docs/ai/ARCHITECTURE.md`.

**specs/**
- Purpose: Product specs and plans.
- Example: `specs/001-driftcore-single-project/spec.md`.

**rfcs/**
- Purpose: RFC documents for major product/architecture decisions.
- Example: `rfcs/RFC-0001-driftcore-mvp.md`.

## Key File Locations

**Entry Points:**
- `packages/server/src/bin/http.ts` - CLI entry for HTTP transport
- `packages/server/src/bin/stdio.ts` - CLI entry for STDIO transport
- `packages/server/src/index.ts` - server factory and state wiring

**Configuration:**
- `.github/workflows/ci.yml` - CI pipeline
- `packages/server/tsconfig.json` - TypeScript compiler configuration
- `packages/server/package.json` - build/test/run scripts
- Runtime config file (not checked in): `driftcore.config.json` resolved via `DRIFTCORE_CONFIG` - `packages/server/src/config.ts`

**Core Logic:**
- `packages/server/src/transports/` - routing and transport adapters
- `packages/server/src/features/` - drush/composer adapters, project manifest, helpers
- `packages/server/src/types.ts` - shared types and response envelopes

**Testing:**
- `packages/server/src/__tests__/` - unit tests (compiled and executed from `packages/server/dist/__tests__/`)
- `packages/server/src/integration/smoke.ts` - integration smoke script

**Documentation:**
- `README.md` - project overview
- `packages/server/README.md` - how to run/configure server
- `docs/ai/` - internal operational docs

## Naming Conventions

**Files:**
- TypeScript source: `*.ts` under `packages/server/src/`
- Feature modules use camelCase filenames (for example `projectManifest.ts`, `drushTools.ts`) in `packages/server/src/features/`
- Tests: `*.test.ts` under `packages/server/src/__tests__/`

**Directories:**
- `src/bin/`, `src/transports/`, `src/features/`, `src/__tests__/` under `packages/server/src/`

**Special Patterns:**
- ESM TypeScript local imports use explicit `.js` extensions (for example `packages/server/src/index.ts` imports `./transports/http.js`).
- `packages/server/dist/` is generated build output and is gitignored via `**/dist/` in `.gitignore`.

## Where to Add New Code

**New Tool (Drush/Composer style):**
- Implementation: `packages/server/src/features/`
- Registration: add to tool list in `packages/server/src/index.ts` (via `getDrushTools()`/`getComposerTools()` or new provider)
- Transport exposure:
  - HTTP route: `packages/server/src/transports/http.ts`
  - STDIO action: `packages/server/src/transports/stdio.ts`
- Tests: add under `packages/server/src/__tests__/`

**New Resource:**
- Definition: `packages/server/src/features/schemaResources.ts` (static) or new feature module
- Registration: `packages/server/src/index.ts`
- Transport exposure:
  - HTTP: `/resources` and any new resource endpoint if needed - `packages/server/src/transports/http.ts`
  - STDIO: `resources` action or a new action - `packages/server/src/transports/stdio.ts`

**New Transport:**
- Adapter: `packages/server/src/transports/`
- Wire-up: `packages/server/src/index.ts`

## Special Directories

**packages/server/dist/**
- Purpose: Build output (`tsc` outDir).
- Source: generated from `packages/server/src/` by `npm run build`.
- Committed: No (gitignored by `**/dist/` in `.gitignore`).

---

*Structure analysis: 2026-02-12*
*Update when directory structure changes*
