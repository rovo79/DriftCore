# Standard MCP STDIO Migration Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a fresh review gate after every task. Use an isolated git worktree. Do not begin DDEV/Lando support, Streamable HTTP, MCP Registry publication, or broad domain-layer refactoring during this plan.

**Goal:** Convert DriftCore from a custom MCP-oriented JSON/REST service into a standards-compliant, locally installable MCP server over STDIO while preserving its existing Drupal discovery, Drush, Composer, assessment, preview, apply, and verification behavior.

**Architecture:** Keep the existing Drupal domain functions and guarded workflow implementations as the source of truth. Introduce a thin standards-compliant MCP adapter using the supported v1 TypeScript SDK, expose current project facts as MCP resources and current operations as MCP tools, and package the STDIO entrypoint as an npm executable. Retain the existing HTTP and custom STDIO transports temporarily as explicitly legacy compatibility surfaces until parity is proven.

**Tech Stack:** TypeScript, Node.js 20+, `@modelcontextprotocol/sdk` v1.29.0, Zod v4, `node:test`, npm package tarballs, MCP STDIO transport.

## Global Constraints

- Preserve the current behavior of project discovery, Drush tools, Composer tools, project checks, assessments, preview tokens, apply operations, and verification operations.
- The official MCP SDK version for this milestone is exactly `1.29.0`; do not adopt the v2 beta.
- STDIO is the only standards-compliant MCP transport required by this plan.
- Do not implement Streamable HTTP in this milestone.
- Do not remove the existing HTTP API or custom line-based STDIO transport until the new MCP parity gate passes.
- Do not implement a separate agent runner, general sandbox, generated SDK, durable queue, or rollback coordinator.
- Do not add arbitrary shell execution.
- Continue using fixed command invocations, `spawn(..., { shell: false })`, timeouts, concurrency limits, filesystem boundaries, preview tokens, and verification.
- Do not change the semantics or expiration rules of existing preview tokens unless a failing compatibility test proves that a change is required.
- Do not publish to npm or the MCP Registry during this plan. Prove package behavior locally with `npm pack`.
- A successful build is not sufficient. Completion requires a real MCP client to initialize the packaged server, list capabilities, read resources, invoke tools, and shut down cleanly.
- Keep each task independently reviewable and commit after its verification gate.

---

## Current Baseline

The current server package is `@driftcore/server` version `0.1.0`. It depends on `yargs` but not the official MCP SDK. Its current STDIO transport accepts custom messages such as:

```json
{"id":1,"action":"project_manifest"}
```

The existing `createMCPServer()` function assembles:

- configuration
- project resources
- Drush tools
- Composer tools
- workflow tools
- logging
- rate limiting
- custom HTTP and STDIO dispatchers

The current workflow layer already implements:

- `drift.upgrade_assessment`
- `drift.config_drift_assessment`
- `drift.scaffold_plan`
- `drift.cache_rebuild`
- `drift.module_scaffold`
- `drift.config_export`

The cache rebuild, module scaffold, and config export workflows already use preview, apply, and verify phases. This plan must expose those capabilities through standard MCP without rewriting them.

---

## Target Consumer Experience

After this plan, a local MCP client must be able to launch DriftCore from a packed npm artifact with configuration equivalent to:

```json
{
  "mcpServers": {
    "driftcore": {
      "command": "npx",
      "args": [
        "-y",
        "/absolute/path/to/driftcore-server-0.2.0.tgz",
        "--project-root",
        "/absolute/path/to/drupal-project"
      ]
    }
  }
}
```

The installed executable must also work directly:

```bash
driftcore --project-root /absolute/path/to/drupal-project
```

The default process mode must be standards-compliant MCP over STDIO. The MCP client owns the process lifecycle. The user must not need to start a separate daemon.

---

## Target MCP Surface

### Resources

Use stable DriftCore URI schemes:

```text
driftcore://project/manifest
driftcore://project/modules
driftcore://project/config-layout
driftcore://project/checks
```

Resource reads must call the existing domain functions:

```text
getProjectManifest
getProjectModules
getProjectConfigLayout
getProjectChecks
```

Do not expose the current static `schema.entityTypes` or `config.exported` templates through the new MCP surface. They are testing/templates rather than authoritative connected-project resources.

### Tools

Expose these exact MCP tool names:

```text
drift_drush_status
drift_drush_pml
drift_composer_info
drift_composer_outdated
drift_upgrade_assessment
drift_config_drift_assessment
drift_scaffold_plan
drift_cache_rebuild_preview
drift_cache_rebuild_apply
drift_cache_rebuild_verify
drift_module_scaffold_preview
drift_module_scaffold_apply
drift_module_scaffold_verify
drift_config_export_preview
drift_config_export_apply
drift_config_export_verify
```

MCP tool names use underscores because tool-name compatibility is broader across clients when names avoid dots and slashes. Existing internal names such as `drift.cache_rebuild` remain valid internal catalog metadata and legacy API identifiers.

### Tool result encoding

Every MCP tool result must include:

```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify(domainResponse, null, 2)
    }
  ],
  structuredContent: domainResponse,
  isError: domainResponse.status === "error" || domainResponse.status === "timeout"
}
```

If the installed v1.29.0 SDK type definitions do not expose `structuredContent`, omit only that property and retain the JSON text content. Do not change the existing domain response envelope to accommodate MCP.

### Input schemas

Use Zod v4 schemas with these exact shapes:

```typescript
const EmptyInput = z.object({}).strict();

const PreviewTokenInput = z.object({
  preview_token: z.string().min(1),
}).strict();

const ScaffoldInput = z.object({
  machine_name: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .min(1)
    .max(64),
  target_type: z.literal("module"),
}).strict();

const ScaffoldApplyInput = ScaffoldInput.extend({
  preview_token: z.string().min(1),
}).strict();
```

The current implementation only applies a module scaffold. Do not advertise theme application unless the existing domain implementation and tests prove full theme support.

---

# Task 1: Establish and Record the Baseline

**Files:**
- Create: `docs/execplans/2026-07-15-standard-mcp-stdio-migration.md`
- Create: `packages/server/src/__tests__/baselineSurface.test.ts`
- Modify only if required to make existing tests deterministic: none expected

**Interfaces:**
- Consumes: current exports from `src/index.ts`, resource functions, tool catalogs, and workflow index
- Produces: a machine-readable baseline test that protects the existing capability inventory during migration

- [x] **Step 1: Create an isolated worktree**

```bash
git status --short
git worktree add ../DriftCore-mcp-stdio -b feat/standard-mcp-stdio
cd ../DriftCore-mcp-stdio
```

Expected:

```text
A new worktree on branch feat/standard-mcp-stdio
```

The source worktree must be clean before continuing.

- [x] **Step 2: Save this plan into the repository**

Create:

```text
docs/execplans/2026-07-15-standard-mcp-stdio-migration.md
```

Use the complete contents of this document.

- [x] **Step 3: Install and run the unmodified baseline**

```bash
npm --prefix packages/server install
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run integration
```

Expected:

```text
lint exits 0
all existing node:test tests pass
HTTP integration smoke test exits 0
```

Record the exact test count and current commit SHA in the plan’s Progress Log before making code changes:

```bash
git rev-parse HEAD
```

- [x] **Step 4: Add a baseline surface test**

Create `packages/server/src/__tests__/baselineSurface.test.ts` that asserts the current internal catalog continues to contain these tool names:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { getComposerTools } from "../features/composerTools.js";
import { getDrushTools } from "../features/drushTools.js";
import { getWorkflowTools } from "../features/workflows/index.js";

test("internal DriftCore catalog retains the pre-MCP capability surface", () => {
  const names = [
    ...getDrushTools(),
    ...getComposerTools(),
    ...getWorkflowTools(),
  ].map((tool) => tool.name);

  assert.deepEqual(
    names.sort(),
    [
      "drift.cache_rebuild",
      "drift.composer_info",
      "drift.composer_outdated",
      "drift.config_drift_assessment",
      "drift.config_export",
      "drift.drush_pml",
      "drift.drush_status",
      "drift.module_scaffold",
      "drift.scaffold_plan",
      "drift.upgrade_assessment",
    ].sort(),
  );
});
```

- [x] **Step 5: Run the baseline test**

```bash
npm --prefix packages/server test
```

Expected:

```text
PASS baselineSurface.test
all pre-existing tests still pass
```

- [x] **Step 6: Commit**

```bash
git add docs/execplans/2026-07-15-standard-mcp-stdio-migration.md \
  packages/server/src/__tests__/baselineSurface.test.ts
git commit -m "test: lock DriftCore capability baseline"
```

### Review Gate 1

Do not proceed unless:

- the original suite passes
- the integration smoke test passes
- the baseline capability test passes
- no production behavior has changed

---

# Task 2: Separate Runtime State Construction from Transport Startup

**Files:**
- Create: `packages/server/src/serverState.ts`
- Create: `packages/server/src/__tests__/serverState.test.ts`
- Modify: `packages/server/src/index.ts`
- Modify: imports in existing transport tests only as required

**Interfaces:**
- Produces:

```typescript
export interface CreateServerStateOptions extends MCPServerOptions {}

export function createServerState(
  options?: CreateServerStateOptions,
): ServerState;
```

- Existing `createMCPServer(options)` remains available for legacy HTTP/custom-STDIO compatibility.
- The new MCP adapter in later tasks consumes `createServerState()`.

- [x] **Step 1: Write the failing state-construction test**

Create `packages/server/src/__tests__/serverState.test.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { createServerState } from "../serverState.js";

test("createServerState assembles resources and tools without starting a transport", () => {
  const state = createServerState({
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.ok(Array.isArray(state.resources));
  assert.ok(Array.isArray(state.tools));
  assert.equal(typeof state.runOperation, "function");
});
```

- [x] **Step 2: Verify the new test fails**

```bash
npm --prefix packages/server test
```

Expected failure:

```text
Cannot find module ../serverState.js
```

- [x] **Step 3: Extract state construction**

Move the configuration loading, binary validation, rate limiter construction, `withOperationLogging`, and `ServerState` assembly currently inside `createMCPServer()` into `createServerState()`.

`src/index.ts` must become a compatibility composition layer:

```typescript
export function createMCPServer(options: MCPServerOptions = {}) {
  const serverState = createServerState(options);

  return {
    async handleStdio() {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      await stdioTransport(rl, serverState);
    },

    async handleHttp(port = 8080, host = "127.0.0.1") {
      serverState.httpHost = host;
      const server = http.createServer((req, res) => {
        void httpTransport(req, res, serverState);
      });

      return new Promise<http.Server>((resolve) => {
        server.listen(port, host, () => {
          serverState.logger.info?.(
            `Legacy HTTP server listening on http://${host}:${
              (server.address() as { port?: number } | null)?.port ?? port
            }`,
          );
          resolve(server);
        });
      });
    },
  };
}

export { createServerState } from "./serverState.js";
```

Do not rename or change domain functions.

- [x] **Step 4: Verify all tests**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run integration
```

Expected:

```text
all commands exit 0
legacy HTTP and custom STDIO behavior remains unchanged
```

- [x] **Step 5: Commit**

```bash
git add packages/server/src/index.ts \
  packages/server/src/serverState.ts \
  packages/server/src/__tests__/serverState.test.ts
git commit -m "refactor: separate server state from transports"
```

### Review Gate 2

Reject the task if:

- domain functions were moved into transport code
- existing route/action behavior changed
- `createMCPServer()` was removed
- tests use a live Drupal project unnecessarily

---

# Task 3: Add the Supported MCP SDK and Result Adapter

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/server/package-lock.json`
- Create: `packages/server/src/mcp/resultAdapter.ts`
- Create: `packages/server/src/__tests__/mcpResultAdapter.test.ts`

**Interfaces:**
- Produces:

```typescript
export function toMcpToolResult(
  response: MCPResponse<unknown>,
): CallToolResult;
```

- [x] **Step 1: Add exact production dependencies**

Run:

```bash
npm --prefix packages/server install --save-exact \
  @modelcontextprotocol/sdk@1.29.0 \
  zod@4
```

Do not install `@modelcontextprotocol/server`; that package belongs to the v2 beta line.

- [x] **Step 2: Write failing result-adapter tests**

Create `packages/server/src/__tests__/mcpResultAdapter.test.ts` with tests for:

- `status: "ok"` produces `isError: false`
- `status: "degraded"` produces `isError: false`
- `status: "error"` produces `isError: true`
- `status: "timeout"` produces `isError: true`
- text content parses back to the original response

Example:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { toMcpToolResult } from "../mcp/resultAdapter.js";

test("toMcpToolResult marks domain errors as MCP errors", () => {
  const response = {
    status: "error" as const,
    error: {
      code: "E_TEST",
      message: "failure",
    },
  };

  const result = toMcpToolResult(response);

  assert.equal(result.isError, true);
  assert.equal(result.content[0]?.type, "text");

  if (result.content[0]?.type !== "text") {
    assert.fail("expected text content");
  }

  assert.deepEqual(JSON.parse(result.content[0].text), response);
});
```

- [x] **Step 3: Verify tests fail**

```bash
npm --prefix packages/server test
```

Expected:

```text
Cannot find module ../mcp/resultAdapter.js
```

- [x] **Step 4: Implement the adapter**

Use the v1 SDK’s `CallToolResult` type. Preserve the entire domain envelope as formatted JSON text.

Only include `structuredContent` if it is accepted by the installed v1.29.0 type. Do not use `as any` to force unsupported protocol fields.

- [x] **Step 5: Verify**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
```

Expected:

```text
all tests pass
package-lock records @modelcontextprotocol/sdk 1.29.0
```

- [x] **Step 6: Commit**

```bash
git add packages/server/package.json \
  packages/server/package-lock.json \
  packages/server/src/mcp/resultAdapter.ts \
  packages/server/src/__tests__/mcpResultAdapter.test.ts
git commit -m "feat: add supported MCP SDK and result adapter"
```

---

# Task 4: Register Authoritative Project Resources

**Files:**
- Create: `packages/server/src/mcp/resources.ts`
- Create: `packages/server/src/__tests__/mcpResources.test.ts`

**Interfaces:**
- Produces:

```typescript
export const DRIFTCORE_RESOURCE_URIS: readonly string[];

export function registerDriftCoreResources(
  server: McpServer,
  state: ServerState,
): void;
```

- [x] **Step 1: Write failing resource-registration tests**

The test must create an SDK `McpServer`, register resources, connect it to an in-memory transport or SDK client transport, then assert:

```text
resources/list returns exactly four DriftCore project resources
resources/read driftcore://project/manifest returns JSON
resources/read driftcore://project/modules returns JSON
resources/read driftcore://project/config-layout returns JSON
resources/read driftcore://project/checks returns JSON
```

Inject deterministic resource functions through the `ServerState` test fixture where existing tests already support overrides. If state does not currently support function injection, mock the filesystem/CLI dependencies using the same fixtures as existing project resource tests. Do not add test-only behavior to production APIs.

- [x] **Step 2: Verify failure before implementation**

```bash
npm --prefix packages/server test
```

Expected:

```text
Cannot find module ../mcp/resources.js
```

- [x] **Step 3: Implement resource registration**

Register these exact resources:

```text
Name: project_manifest
URI:  driftcore://project/manifest

Name: project_modules
URI:  driftcore://project/modules

Name: project_config_layout
URI:  driftcore://project/config-layout

Name: project_checks
URI:  driftcore://project/checks
```

Every handler must call `state.runOperation()` with `kind: "resource"` and the existing domain function.

Return:

```typescript
{
  contents: [
    {
      uri: requestedUri.href,
      mimeType: "application/json",
      text: JSON.stringify(response, null, 2),
    },
  ],
}
```

Do not register static schema/config templates.

- [x] **Step 4: Verify**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
```

Expected:

```text
all four resources are discoverable and readable through SDK client calls
legacy tests still pass
```

- [x] **Step 5: Commit**

```bash
git add packages/server/src/mcp/resources.ts \
  packages/server/src/__tests__/mcpResources.test.ts
git commit -m "feat: expose project facts as MCP resources"
```

### Review Gate 4

Reject if resource handlers reimplement discovery or parse filesystem data themselves. They must delegate to existing domain functions.

---

# Task 5: Register Read-Only MCP Tools

**Files:**
- Create: `packages/server/src/mcp/toolSchemas.ts`
- Create: `packages/server/src/mcp/readTools.ts`
- Create: `packages/server/src/__tests__/mcpReadTools.test.ts`

**Interfaces:**
- Produces:

```typescript
export const EmptyInput: ZodObject<...>;
export const ScaffoldInput: ZodObject<...>;

export function registerReadOnlyTools(
  server: McpServer,
  state: ServerState,
): void;
```

- [ ] **Step 1: Add schema tests**

Assert:

```text
EmptyInput rejects unknown keys
ScaffoldInput accepts {machine_name:"acme_blog",target_type:"module"}
ScaffoldInput rejects uppercase names
ScaffoldInput rejects paths and punctuation
ScaffoldInput rejects target_type:"theme"
```

- [ ] **Step 2: Add MCP client tests for read-only tools**

Assert `tools/list` includes:

```text
drift_drush_status
drift_drush_pml
drift_composer_info
drift_composer_outdated
drift_upgrade_assessment
drift_config_drift_assessment
drift_scaffold_plan
```

Call at least:

```text
drift_composer_info
drift_upgrade_assessment
drift_scaffold_plan
```

Verify each result preserves the existing domain envelope in JSON text.

- [ ] **Step 3: Verify failure**

```bash
npm --prefix packages/server test
```

Expected failure because tool modules do not exist.

- [ ] **Step 4: Implement the schemas and registrations**

Map tool handlers exactly:

```text
drift_drush_status             → runDrushStatus
drift_drush_pml                → runDrushPml
drift_composer_info            → runComposerInfo
drift_composer_outdated        → runComposerOutdated
drift_upgrade_assessment       → runUpgradeAssessment
drift_config_drift_assessment  → runConfigDriftAssessment
drift_scaffold_plan            → runScaffoldPlanning
```

Every handler must:

1. validate input through the SDK/Zod schema
2. call `state.runOperation()`
3. delegate to the existing domain function
4. pass the response through `toMcpToolResult()`

- [ ] **Step 5: Verify**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
```

Expected:

```text
all read tools list and call successfully through an SDK client
all legacy tests pass
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/mcp/toolSchemas.ts \
  packages/server/src/mcp/readTools.ts \
  packages/server/src/__tests__/mcpReadTools.test.ts
git commit -m "feat: expose DriftCore read tools through MCP"
```

---

# Task 6: Register Guarded Workflow Tools

**Files:**
- Create: `packages/server/src/mcp/writeTools.ts`
- Modify: `packages/server/src/mcp/toolSchemas.ts`
- Create: `packages/server/src/__tests__/mcpWriteTools.test.ts`

**Interfaces:**
- Produces:

```typescript
export const PreviewTokenInput: ZodObject<...>;
export const ScaffoldApplyInput: ZodObject<...>;

export function registerWriteWorkflowTools(
  server: McpServer,
  state: ServerState,
): void;
```

- [ ] **Step 1: Write preview/apply/verify lifecycle tests**

Use existing workflow fixtures to assert these tool sequences:

```text
drift_cache_rebuild_preview
  → returns preview_token
drift_cache_rebuild_apply with preview_token
  → succeeds
reusing the same preview_token
  → fails
drift_cache_rebuild_verify
  → returns verification envelope
```

Repeat the registration/call coverage for:

```text
drift_module_scaffold_preview
drift_module_scaffold_apply
drift_module_scaffold_verify
drift_config_export_preview
drift_config_export_apply
drift_config_export_verify
```

The test may stub bounded CLI execution and temporary filesystem fixtures using existing domain test seams. It must not run against the developer’s real Drupal project.

- [ ] **Step 2: Verify failure before implementation**

```bash
npm --prefix packages/server test
```

Expected:

```text
write workflow tools are not registered
```

- [ ] **Step 3: Implement write tool registration**

Map exactly:

```text
drift_cache_rebuild_preview       → runCacheRebuildPreview
drift_cache_rebuild_apply         → runCacheRebuildApply
drift_cache_rebuild_verify        → runCacheRebuildVerify
drift_module_scaffold_preview     → runModuleScaffoldPreview
drift_module_scaffold_apply       → runModuleScaffoldApply
drift_module_scaffold_verify      → runModuleScaffoldVerify
drift_config_export_preview       → runConfigExportPreview
drift_config_export_apply         → runConfigExportApply
drift_config_export_verify        → runConfigExportVerify
```

Do not combine preview, apply, and verify into one MCP call. The explicit lifecycle is part of DriftCore’s safety model.

Do not allow MCP annotations or descriptions to imply that apply is read-only.

- [ ] **Step 4: Verify**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
```

Expected:

```text
workflow lifecycle tests pass
single-use preview-token behavior is unchanged
legacy workflow tests pass
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/mcp/writeTools.ts \
  packages/server/src/mcp/toolSchemas.ts \
  packages/server/src/__tests__/mcpWriteTools.test.ts
git commit -m "feat: expose guarded workflows through MCP"
```

### Review Gate 6

Reject if:

- apply tools can run without preview tokens
- preview tokens become reusable
- handlers execute shell strings
- verification is collapsed into apply
- domain workflow implementations are duplicated

---

# Task 7: Build the Standards-Compliant MCP Server and STDIO Entry Point

**Files:**
- Create: `packages/server/src/mcp/server.ts`
- Create: `packages/server/src/bin/mcp.ts`
- Create: `packages/server/src/__tests__/mcpServer.test.ts`
- Keep unchanged: `packages/server/src/bin/stdio.ts` as the legacy custom transport for now

**Interfaces:**
- Produces:

```typescript
export function createDriftCoreMcpServer(
  state: ServerState,
): McpServer;

export async function runMcpStdio(
  options?: MCPServerOptions,
): Promise<void>;
```

- [ ] **Step 1: Write a server capability test**

Connect an SDK client to the new server using an in-memory transport and verify:

```text
initialize succeeds
server name is driftcore
server version matches package version
resources/list succeeds
tools/list succeeds
resources/read succeeds
tools/call succeeds
```

- [ ] **Step 2: Verify failure**

```bash
npm --prefix packages/server test
```

Expected failure because `mcp/server.ts` does not exist.

- [ ] **Step 3: Implement server composition**

`createDriftCoreMcpServer(state)` must:

```typescript
const server = new McpServer({
  name: "driftcore",
  version: packageVersion,
});

registerDriftCoreResources(server, state);
registerReadOnlyTools(server, state);
registerWriteWorkflowTools(server, state);

return server;
```

Read the version from a generated build constant or JSON import supported by the existing TypeScript configuration. Do not hardcode a second independent version string without a synchronization test.

- [ ] **Step 4: Implement the STDIO runner**

`src/bin/mcp.ts` must:

1. parse CLI/config options
2. construct `ServerState`
3. construct `McpServer`
4. connect `StdioServerTransport`
5. write operational logs only to stderr
6. set a nonzero exit code on startup failure

The MCP protocol stream on stdout must contain only protocol messages.

- [ ] **Step 5: Verify**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
```

Expected:

```text
MCP initialization and capability tests pass
legacy custom STDIO tests still pass
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/mcp/server.ts \
  packages/server/src/bin/mcp.ts \
  packages/server/src/__tests__/mcpServer.test.ts
git commit -m "feat: add standards-compliant MCP STDIO server"
```

---

# Task 8: Add Consumer CLI and Project Discovery

**Files:**
- Create: `packages/server/src/cli.ts`
- Create: `packages/server/src/projectRoot.ts`
- Modify: `packages/server/src/bin/mcp.ts`
- Modify: `packages/server/src/config.ts`
- Create: `packages/server/src/__tests__/cli.test.ts`
- Create: `packages/server/src/__tests__/projectRoot.test.ts`

**Interfaces:**
- Produces:

```typescript
export interface DriftCoreCliOptions {
  projectRoot?: string;
  configPath?: string;
}

export function parseCliArgs(argv: string[]): DriftCoreCliOptions;

export function discoverProjectRoot(startPath: string): string | undefined;
```

- [ ] **Step 1: Write CLI parsing tests**

Cover:

```text
--project-root /path
--config /path/to/driftcore.config.json
both options together
unknown option rejected
missing option value rejected
```

- [ ] **Step 2: Write project discovery tests**

Use temporary directories to cover:

```text
current directory contains composer.json with drupal/core-recommended
parent directory contains that composer.json
conventional web/core path
conventional docroot/core path
unrelated composer project returns undefined
filesystem root terminates cleanly
```

Do not require a real Composer install.

- [ ] **Step 3: Implement configuration precedence**

Resolve project/config in this exact order:

```text
1. --project-root
2. --config
3. DRIFTCORE_CONFIG
4. driftcore.config.json in current working directory
5. upward discovery from process.cwd()
```

Public CLI input is `projectRoot`, representing the Composer project root.

Internally derive `drupalRoot`:

```text
<projectRoot>/web       when web/core exists
<projectRoot>/docroot   when docroot/core exists
<projectRoot>           when core exists
```

If an explicit legacy config supplies `drupalRoot`, preserve it.

If no project can be resolved, startup must fail with a concise stderr message and exit code 1. Do not start a degraded MCP server with no useful project context.

- [ ] **Step 4: Verify**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
```

Expected:

```text
CLI precedence and discovery tests pass
legacy DRIFTCORE_CONFIG behavior still passes
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/cli.ts \
  packages/server/src/projectRoot.ts \
  packages/server/src/bin/mcp.ts \
  packages/server/src/config.ts \
  packages/server/src/__tests__/cli.test.ts \
  packages/server/src/__tests__/projectRoot.test.ts
git commit -m "feat: add project-aware DriftCore CLI"
```

### Review Gate 8

Reject if a standard Drupal Composer project still requires a config file.

---

# Task 9: Package DriftCore as an Executable npm Artifact

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/server/package-lock.json`
- Create: `packages/server/src/__tests__/packageMetadata.test.ts`
- Create: `packages/server/integration/packedMcpSmoke.ts`

**Interfaces:**
- Produces the executable:

```text
driftcore
```

- [ ] **Step 1: Add package metadata tests**

Assert `package.json` contains:

```json
{
  "name": "@driftcore/server",
  "version": "0.2.0",
  "type": "module",
  "bin": {
    "driftcore": "./dist/bin/mcp.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20"
  }
}
```

If `README.md` or `LICENSE` do not exist inside `packages/server`, either:

- copy them during `prepack`, or
- adjust `files` to include only files genuinely present in the package.

The packed artifact must contain its own usable README and license.

- [ ] **Step 2: Modify scripts**

Add:

```json
{
  "scripts": {
    "start": "node dist/bin/mcp.js",
    "start:mcp": "node dist/bin/mcp.js",
    "start:stdio:legacy": "node dist/bin/stdio.js",
    "pack:check": "npm run build && npm pack --dry-run",
    "integration:mcp": "npm run build && node dist/integration/packedMcpSmoke.js"
  }
}
```

Keep `start:http` during compatibility.

Remove or rename the ambiguous current `start:stdio`; it must not continue to imply that the custom action protocol is standard MCP.

- [ ] **Step 3: Write packed artifact smoke test**

`packedMcpSmoke.ts` must:

1. run `npm pack --json`
2. create a temporary consumer directory
3. install the generated tarball into that directory
4. create a minimal temporary Drupal-like fixture with:
   - Composer metadata identifying Drupal
   - a conventional `web/core` directory
5. spawn the installed `driftcore` executable through `StdioClientTransport`
6. initialize an SDK `Client`
7. list resources
8. list tools
9. read `driftcore://project/manifest`
10. call one read-only tool that does not require a live database
11. close the client
12. verify the process exits cleanly
13. delete the generated tarball and temporary directories

The test must use the packed artifact, not `dist/bin/mcp.js` directly.

- [ ] **Step 4: Verify package contents and smoke test**

```bash
npm --prefix packages/server run pack:check
npm --prefix packages/server run integration:mcp
```

Expected:

```text
tarball includes dist/bin/mcp.js
tarball includes package metadata and documentation
packed consumer initializes over MCP
resource and tool discovery work
manifest read works
read-only tool call works
process closes cleanly
```

- [ ] **Step 5: Run full suite**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run integration
npm --prefix packages/server run integration:mcp
```

Expected:

```text
all commands exit 0
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/package.json \
  packages/server/package-lock.json \
  packages/server/src/__tests__/packageMetadata.test.ts \
  packages/server/integration/packedMcpSmoke.ts
git commit -m "feat: package DriftCore as an MCP executable"
```

### Review Gate 9: Consumer Proof

This is the milestone’s decisive gate.

Do not claim success unless a clean temporary consumer can use the packed tarball without:

- cloning DriftCore
- running DriftCore’s TypeScript compiler
- invoking a source-checkout-relative path
- manually starting a daemon
- sending DriftCore’s legacy `{action: ...}` messages

---

# Task 10: Mark Legacy Transports Explicitly and Preserve Compatibility

**Files:**
- Rename: `packages/server/src/transports/stdio.ts` → `packages/server/src/transports/legacyStdio.ts`
- Rename: `packages/server/src/bin/stdio.ts` → `packages/server/src/bin/legacyStdio.ts`
- Modify: `packages/server/src/index.ts`
- Modify: legacy transport imports/tests
- Modify: `packages/server/src/bin/http.ts`
- Create: `docs/decisions/standard-mcp-stdio.md`

**Interfaces:**
- New primary executable: `driftcore`
- Temporary compatibility commands:
  - `npm run start:stdio:legacy`
  - `npm run start:http:legacy`

- [ ] **Step 1: Rename custom STDIO files**

Use `git mv`:

```bash
git mv packages/server/src/transports/stdio.ts \
  packages/server/src/transports/legacyStdio.ts
git mv packages/server/src/bin/stdio.ts \
  packages/server/src/bin/legacyStdio.ts
```

Update imports and test names.

- [ ] **Step 2: Rename HTTP script as legacy**

The existing route-per-operation REST interface is not Streamable HTTP MCP. Rename the npm script:

```json
{
  "start:http:legacy": "node dist/bin/http.js"
}
```

Do not implement `/mcp` in this plan.

- [ ] **Step 3: Add the architecture decision**

Create `docs/decisions/standard-mcp-stdio.md` recording:

```text
Decision:
- official MCP SDK v1.29.0
- standard STDIO is the primary local transport
- domain services remain transport-independent
- old REST and action-STDIO surfaces are temporary legacy adapters
- Streamable HTTP is deferred
- DDEV/Lando execution backends are deferred
- package publication is deferred until local tarball proof is accepted
```

Include removal criteria for legacy transports:

```text
- one released version has shipped with standard MCP
- no known downstream consumer requires legacy action-STDIO
- HTTP API has either a documented independent use case or is removed
```

- [ ] **Step 4: Verify all compatibility tests**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run integration
npm --prefix packages/server run integration:mcp
```

Expected:

```text
standard MCP passes
legacy REST integration passes
legacy custom STDIO tests pass
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src \
  packages/server/package.json \
  packages/server/package-lock.json \
  docs/decisions/standard-mcp-stdio.md
git commit -m "docs: distinguish standard MCP from legacy transports"
```

---

# Task 11: Rewrite Documentation Around the Consumer Path

**Files:**
- Modify: `README.md`
- Modify: `docs/ai/ARCHITECTURE.md`
- Modify: `docs/ai/COMMANDS.md`
- Modify: `docs/ai/DEPLOYMENT.md`
- Modify: `docs/ai/SECURITY_AND_RISKS.md`
- Modify: `docs/ai/TESTING.md`
- Modify: `packages/server/README.md` or create it if package packing requires it
- Create: `packages/server/src/__tests__/readmeCommands.test.ts`

**Interfaces:**
- Documents the installed consumer path as primary.
- Documents source checkout instructions as contributor-only.
- Clearly labels legacy transports.

- [ ] **Step 1: Replace the README quick start**

The first installation example must use the packed/published package model:

```json
{
  "mcpServers": {
    "driftcore": {
      "command": "npx",
      "args": [
        "-y",
        "@driftcore/server",
        "--project-root",
        "/absolute/path/to/drupal-project"
      ]
    }
  }
}
```

Until the package is published, add an explicit development note showing the tarball path generated by `npm pack`.

Do not present cloning, `npm install`, and `npm run build` as the primary user installation route. Put those under “Contributing from source.”

- [ ] **Step 2: Document the actual protocol surface**

List:

- four resource URIs
- all 16 MCP tool names
- input schemas for scaffold and apply operations
- preview/apply/verify safety model
- package CLI options
- configuration precedence
- Node requirement

- [ ] **Step 3: Correct architecture terminology**

Use:

```text
Standard MCP STDIO
Legacy REST API
Legacy DriftCore action-STDIO
```

Never call the REST route collection “MCP HTTP.”

- [ ] **Step 4: Add command verification tests**

Create a lightweight test that extracts documented npm scripts and verifies those script keys exist in `package.json`. At minimum cover:

```text
build
lint
test
start
start:mcp
start:stdio:legacy
start:http:legacy
pack:check
integration:mcp
```

- [ ] **Step 5: Run documentation verification**

```bash
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run pack:check
npm --prefix packages/server run integration:mcp
```

- [ ] **Step 6: Commit**

```bash
git add README.md \
  docs/ai \
  packages/server/README.md \
  packages/server/src/__tests__/readmeCommands.test.ts
git commit -m "docs: make packaged MCP usage the primary workflow"
```

---

# Task 12: Final End-to-End Acceptance and Closeout

**Files:**
- Modify: `docs/execplans/2026-07-15-standard-mcp-stdio-migration.md`
- No production changes unless a verified acceptance failure requires a fix

- [ ] **Step 1: Run the complete verification matrix**

```bash
npm --prefix packages/server ci
npm --prefix packages/server run lint
npm --prefix packages/server test
npm --prefix packages/server run integration
npm --prefix packages/server run pack:check
npm --prefix packages/server run integration:mcp
```

Expected:

```text
all commands exit 0
```

- [ ] **Step 2: Verify the packed package manually through MCP Inspector**

Build and pack:

```bash
cd packages/server
npm run build
npm pack
```

Launch with the MCP Inspector using the generated tarball and a non-production Drupal fixture.

Verify manually:

```text
initialization succeeds
four project resources appear
all expected tools appear
project manifest is readable
upgrade assessment is callable
cache rebuild preview returns a token
no apply action is run against a real project
shutdown is clean
```

Record the exact Inspector command and observed results in the Progress Log.

- [ ] **Step 3: Inspect stdout discipline**

Run the executable under an MCP client and confirm:

```text
stdout contains protocol traffic only
diagnostic logs go to stderr
```

Any ordinary log line on stdout is a release blocker.

- [ ] **Step 4: Inspect the tarball**

```bash
npm --prefix packages/server pack --dry-run
```

Confirm:

```text
dist/bin/mcp.js is present
source tests are not unnecessarily included
README and license are present
package does not include local config, fixtures, secrets, or generated tarballs
```

- [ ] **Step 5: Review scope discipline**

Confirm that the diff does not contain:

```text
DDEV backend
Lando backend
Docker Compose backend
Streamable HTTP
MCP Registry metadata
remote authentication
general sandbox
agent runner
generated SDK
unrelated domain refactor
```

- [ ] **Step 6: Update the plan Progress Log**

Record:

- baseline commit
- final commit
- test counts
- packed tarball filename
- Inspector result
- any accepted deviations
- legacy transport status
- follow-on issues created

- [ ] **Step 7: Final commit**

```bash
git add docs/execplans/2026-07-15-standard-mcp-stdio-migration.md
git commit -m "docs: close standard MCP STDIO migration plan"
```

---

## Acceptance Criteria

The implementation is complete only when every statement below is true.

### Protocol

- DriftCore completes standard MCP initialization through the official SDK.
- A client can call `resources/list`, `resources/read`, `tools/list`, and `tools/call`.
- The new server does not require DriftCore-specific action envelopes.
- STDOUT is reserved for MCP protocol traffic.

### Capability parity

- All four authoritative project resources are exposed.
- All existing read-only inspections and assessments are available.
- Cache rebuild, module scaffold, and config export retain separate preview/apply/verify operations.
- Preview tokens remain short-lived and single-use.
- Existing domain response envelopes remain intact.

### Consumer installation

- `package.json` exposes a `driftcore` executable.
- A packed tarball works from a clean temporary consumer.
- The consumer does not need a source checkout or TypeScript build.
- `--project-root` works for a conventional Drupal Composer project.
- A config file is optional for a conventional project.

### Compatibility

- Existing domain and workflow tests pass.
- Legacy HTTP integration passes.
- Legacy custom STDIO tests pass until a separate removal decision.
- Existing bounded execution safety remains intact.

### Documentation

- README leads with MCP client configuration, not repository build steps.
- Source installation is clearly labeled as contributor workflow.
- REST is not mislabeled as MCP HTTP.
- Deferred items remain deferred.

---

## Explicitly Deferred Follow-On Work

Create separate proposals only after this plan is accepted.

### Execution backends

Potential future interface:

```typescript
interface ExecutionBackend {
  run(
    executable: string,
    args: readonly string[],
    options: RunCliOptions,
  ): Promise<CliResult>;
}
```

Candidate implementations:

```text
HostExecutionBackend
DdevExecutionBackend
LandoExecutionBackend
DockerComposeExecutionBackend
```

Do not begin this work in the MCP migration branch.

### Streamable HTTP

Only consider this after:

- STDIO has shipped
- a remote/server deployment use case exists
- authentication and authorization requirements are written
- session and origin-security requirements are defined

### npm and MCP Registry publication

Only publish after:

- tarball consumer proof passes
- package name ownership is confirmed
- README reflects the final package name
- versioning and release automation are defined
- secrets/provenance checks pass

### Legacy transport removal

Use a separate removal plan after a compatibility window and downstream-consumer check.

---

## Risks and Controls

| Risk | Control |
|---|---|
| Agent rewrites the domain layer | Every MCP handler must delegate to existing functions |
| SDK v2 beta churn | Pin v1.29.0 exactly |
| False success from source checkout | Require packed-tarball consumer smoke test |
| Protocol corruption | Assert stdout contains protocol traffic only |
| Safety regression | Lifecycle tests preserve preview token and verification behavior |
| Scope explosion | Explicitly defer HTTP, containers, registry, auth, runner, sandbox, SDK generation |
| Misleading documentation | Rename old transports as legacy before README closeout |
| Package works only on maintainer machine | Temporary consumer directory and fixture-based integration test |
| Config remains cumbersome | Require `--project-root` and upward project discovery |
| Tool-name incompatibility | Use stable underscore-separated MCP names |

---

## Progress Log

The implementing agent must maintain this section during execution.

```text
Baseline commit: 7cb965f97bd457eeff61ebde6178a228589e3519
Baseline test count: 89 passing tests before Task 1 changes; 90 passing tests after adding baselineSurface.test.ts.
Task 1: Worktree created at /Users/rob/Dev/DriftCore-mcp-stdio on feat/standard-mcp-stdio. Baseline lint, test, and integration smoke test passed. The capability baseline test passed. Committed as 5352971 (test: lock DriftCore capability baseline). Commit 0f528a9 (docs: record MCP migration baseline) then marked Task 1 complete and recorded the verified baseline in this Progress Log.
Task 2: Extracted runtime state construction into src/serverState.ts. The new unit test first failed because the module was absent, then passed without requiring a Drupal fixture. Lint, 91-test suite, and HTTP integration smoke test passed. Committed as 42aab6e (refactor: separate server state from transports).
Task 3: Installed @modelcontextprotocol/sdk 1.29.0 and zod 4.4.3. Added a typed result adapter with text and structured response envelopes; only error and timeout map to MCP errors. Tests cover ok, degraded, error, timeout, and not_configured. SDK v1.29.0 directly supports structuredContent. The default suite exposed a full-suite-only legacy STDIO test timeout caused by its 2-second polling cap under subprocess contention; the cap was extended to 10 seconds and the default 96-test suite passed. Committed as 14d721b (feat: add supported MCP SDK and result adapter).
Task 4: Registered exactly four authoritative project resources through McpServer. SDK Client and linked InMemoryTransport tests list only those resources, prove static template identifiers are absent, read all four JSON envelopes, and assert every read used state.runOperation with kind resource. Tests use a null-config deterministic ServerState and do not access a Drupal project. Lint and the 98-test suite passed. Committed as f462bce (feat: expose project facts as MCP resources).
Task 5:
Task 6:
Task 7:
Task 8:
Task 9:
Task 10:
Task 11:
Final commit:
Final test count:
Packed tarball:
MCP Inspector result:
Accepted deviations:
Follow-on issues:
```

---

## Final Handoff Requirement

The implementing agent’s final report must include:

```text
1. What changed
2. Exact MCP resources and tools exposed
3. Package/CLI usage example
4. Configuration precedence
5. Full verification commands and results
6. Packed consumer smoke-test result
7. MCP Inspector result
8. Legacy transport status
9. Complete changed-file list
10. Deferred follow-on work
```

A summary such as “added MCP support” is not sufficient.
