# Codebase Concerns

**Analysis Date:** 2026-02-12

## Tech Debt

**Placeholder sandbox execution API:**
- Issue: `executeInSandbox()` is a stub that returns canned output.
- File: `packages/server/src/features/sandboxExecution.ts`
- Why: sandboxing for user-supplied scripts is TODO.
- Impact: Any future exposure of this feature is a high-risk area (security + isolation).
- Fix approach: Design a sandbox model first (process/container isolation, resource limits), then implement with explicit allowlists and tests.

**SDK generation is unimplemented:**
- Issue: SDK generation pipeline is a placeholder.
- File: `packages/server/src/features/sdkGeneration.ts`
- Impact: Any docs/plans implying SDK generation will be ahead of implementation.
- Fix approach: Define schema-to-SDK contract, add minimal generator for one target language, add tests.

**Static schema resources may drift from reality:**
- Issue: `schemaResources.ts` contains hard-coded entity type/config examples.
- File: `packages/server/src/features/schemaResources.ts`
- Impact: Resource data may become stale or misleading compared to real Drupal projects.
- Fix approach: Replace static payloads with dynamically discovered data (or clearly label as examples) and add versioning/contract tests.

**Docs/ai appear partially outdated vs repository state:**
- Issue: `docs/ai/CODEBASE_MAP.md` states CI workflows are not present, but `.github/workflows/ci.yml` exists.
- Files: `docs/ai/CODEBASE_MAP.md`, `.github/workflows/ci.yml`
- Impact: Consumers may rely on incorrect operational assumptions.
- Fix approach: Update `docs/ai/*` to match current repo state.

## Known Bugs

- None documented in-code; failures are generally represented as structured error envelopes.

## Security Considerations

**No auth on HTTP endpoints:**
- Risk: Anyone who can reach the HTTP port can trigger local CLI executions and read project metadata.
- Files: `packages/server/src/transports/http.ts`, `packages/server/src/index.ts`
- Current mitigation: None in application code.
- Recommendations: Add authn/authz (token or mTLS) before exposing beyond localhost; add rate limiting.

**Diagnostics can leak sensitive filesystem paths and stderr:**
- Risk: Responses may include `cwd`, command/args, and truncated stderr.
- Files: `packages/server/src/features/errorMapping.ts`, `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`
- Current mitigation: stderr truncation to 2000 chars.
- Recommendations: Add optional redaction mode for paths/stderr; ensure HTTP transport is not exposed unintentionally.

**Binary path trust:**
- Risk: `drushPath` / `composerPath` can point to arbitrary executables.
- Files: `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`
- Recommendations: Validate configured paths exist and optionally enforce allowlists/expected locations.

## Performance Bottlenecks

**Slow external CLI calls:**
- Problem: Drush/Composer calls can be slow depending on the target Drupal project.
- Files: `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`
- Current mitigation: timeouts and `maxParallelCli` concurrency limiting; TTL cache for `drift.drush_pml`.
- Improvement path: Add caching for expensive composer operations; expose clearer timeout configuration guidance.

## Fragile Areas

**Subprocess kill behavior:**
- Why fragile: Timeout handling uses SIGKILL and (on non-Windows) attempts process-group kill via negative PID.
- File: `packages/server/src/features/sandboxExecution.ts`
- Common failures: Orphaned subprocesses if kill fails; platform differences.
- Safe modification: Add tests around timeout and process cleanup; be cautious when changing `detached` and kill logic.

**Parsing CLI output that may include non-JSON preamble:**
- Why fragile: Both Drush and Composer parsers search for the first `{` and parse from there.
- Files: `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`
- Common failures: Unexpected warnings/format changes could break parsing.
- Safe modification: Add more defensive parsing and fuzz tests using malformed outputs.

## Scaling Limits

**No built-in rate limiting/time budgeting for HTTP transport:**
- Limit: Exposed deployments could be abused to spawn repeated subprocesses.
- Files: `packages/server/src/transports/http.ts`, `packages/server/src/features/sandboxExecution.ts`
- Scaling path: Add per-endpoint rate limiting and a global request budget.

## Dependencies at Risk

**Node version dependency:**
- Risk: Code assumes Node 20+ (global `fetch` used in integration test).
- Files: `packages/server/src/integration/smoke.ts`, `.github/workflows/ci.yml`
- Migration plan: If supporting older Node, add fetch polyfill or replace with `http` client.

## Missing Critical Features

**Transport-level security controls:**
- Problem: No built-in auth for HTTP/STDIO transports.
- Files: `packages/server/src/transports/http.ts`, `packages/server/src/transports/stdio.ts`
- Blocks: Safe multi-user/shared-host deployments.

## Test Coverage Gaps

**Malformed CLI output resilience:**
- What's not tested: Robust handling of unexpected Drush/Composer output formats.
- Files: `packages/server/src/features/drushTools.ts`, `packages/server/src/features/composerTools.ts`
- Priority: Medium.
- Difficulty to test: Requires curated fixtures or fuzz-style input generation.

**HTTP routing contract tests:**
- What's not tested: Detailed per-route response shapes (beyond smoke coverage).
- Files: `packages/server/src/transports/http.ts`, `packages/server/src/integration/smoke.ts`
- Priority: Medium.

---

*Concerns audit: 2026-02-12*
*Update as issues are fixed or new ones discovered*
