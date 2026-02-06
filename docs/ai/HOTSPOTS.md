# HOTSPOTS

- **Method used**
  - Hotspots estimated from git history file-touch counts (current tracked files only).
  - Command used: `git log --name-only --pretty=format: | rg '.' | while read f; do [ -e "$f" ] && echo "$f"; done | sort | uniq -c | sort -nr | head -n 30`

## Most changed areas (current files)

- **Project docs / planning hotspots**
  - `README.md` (high churn)
  - `rfcs/RFC-0001-driftcore-mvp.md` (high churn)
- **Server API surface hotspots**
  - `packages/server/src/index.ts`
  - `packages/server/src/transports/http.ts`
  - `packages/server/src/transports/stdio.ts`
  - `packages/server/src/types.ts`
- **Tool behavior hotspots**
  - `packages/server/src/features/drushTools.ts`
  - `packages/server/src/features/schemaResources.ts`
  - `packages/server/src/features/sandboxExecution.ts`
- **Packaging/test hotspots**
  - `packages/server/package.json`
  - `packages/server/src/integration/smoke.ts`
  - `packages/server/src/__tests__/schemaResources.test.ts`

## Practical implications

- If changing tool contracts or route behavior, expect ripple effects in:
  - `src/transports/*`
  - `src/features/*Tools.ts`
  - `src/types.ts`
  - tests under `src/__tests__` and `src/integration`.
- Documentation and implementation can drift; cross-check README/RFC claims against `packages/server/src/*` before making architecture-level changes.

## Assumptions

- File-touch count is a coarse proxy for risk; it does not measure line-level churn or bug density.
- Some historic hotspots from deleted paths were intentionally excluded to keep this actionable for current code.
