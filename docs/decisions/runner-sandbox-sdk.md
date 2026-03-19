# Runner, Sandbox, and SDK Decision

Milestone 7 reviewed the remaining speculative pieces in DriftCore: a separate runner package, a general sandbox execution engine, and a generated SDK pipeline. The conclusion is that none of them should be promoted to production work now. The current server already covers the real workflows in this repository, and the contract/documentation surface is sufficient for clients to integrate directly.

## Evaluation Criteria

The decision here is based on three concrete questions.

Runner: does DriftCore need a separate package or service to orchestrate multi-step workflows, or can the server and client continue to chain the existing inspect/plan/preview/apply/verify calls?

Sandbox: does DriftCore need to run user-supplied or AI-authored code in an isolated runtime, or are the current bounded CLI workflows enough for the product that exists today?

SDK: does DriftCore need generated client libraries, or is the existing MCP contract document plus TypeScript source types enough for integration?

## Runner

The repository already implements the workflow pattern that a dedicated runner would have to coordinate. The server exposes read-only assessment flows and write flows that follow preview/apply/verify, and the transport layers are thin dispatchers rather than orchestration engines. The implementation in `packages/server/src/features/workflows/index.ts` and the individual workflow modules shows that the server itself already owns the sequence and safety boundary for the known tasks.

The most relevant examples are the cache rebuild, module scaffold, and config export workflows in `packages/server/src/features/workflows/cacheRebuild.ts`, `packages/server/src/features/workflows/moduleScaffold.ts`, and `packages/server/src/features/workflows/configExport.ts`. Each one uses preview tokens, bounded apply steps, and post-apply verification. That is the core of what a minimal runner would have to provide, but it is already available inside the server.

There is no repository evidence of a durable queue, a restartable job state machine, or a cross-session rollback coordinator. There is also no product requirement in the current codebase that a server-side runner would satisfy better than a client sequencing the existing MCP calls.

Recommendation: DEFER.

Trigger conditions for revisiting: a workflow that must survive process restarts, resume after an interruption without client re-planning, or coordinate a long fan-out/fan-in sequence that cannot be expressed as sequential MCP calls.

## Sandbox

`packages/server/src/features/sandboxExecution.ts` contains the real execution primitive in this repository: `runCliCommand`. That function already uses `spawn(..., shell: false)`, enforces timeouts, tracks concurrency, and terminates timed-out subprocesses. The exported `executeInSandbox` function is a stub, and no production path in the repository calls it.

The current workflows do not need arbitrary code execution. They invoke fixed Drush and Composer commands or inspect local Drupal metadata. The server already has a bounded execution model for those cases, and the security documentation in `docs/ai/SECURITY_AND_RISKS.md` treats deeper process isolation as a future risk area rather than a current requirement.

A general sandbox would have to define and enforce filesystem, network, and resource limits across the supported developer environments. The repository does not currently model those constraints, and there is no concrete use case here that justifies taking on that complexity and attack surface.

Recommendation: DEFER.

Trigger conditions for revisiting: a real feature that must execute untrusted or user-authored code, plus a clearly specified isolation boundary that can be tested on the supported platforms.

## SDK

The repository already exposes the current contract in `packages/server/docs/CONTRACT.md`, and the server source types in `packages/server/src/types.ts` define the implementation surface. The public API is small: a manifest resource, a few discovery tools, and a handful of workflow endpoints. That is a manageable contract to consume directly without generated client libraries.

The repository also contains no evidence of actual downstream clients that are blocked by manual MCP JSON handling or by reading the contract document. The current integration surface is simple enough that generated code would mostly mirror the contract rather than unlock a new capability.

`packages/server/src/features/sdkGeneration.ts` is still a stub, but the decision here is that generated SDKs are not justified by the current product scope. Maintaining a generated library would add versioning churn and contract-sync overhead for little gain.

Recommendation: DEFER.

Trigger conditions for revisiting: a concrete downstream client inventory showing repeated integration pain, or a meaningful expansion of the public API that makes a generated client more valuable than the contract document and source types.

## Stub Disposition

No production code was added or removed in this milestone. The placeholders remain intentionally non-production, but they now have an explicit written decision behind them.

The practical result is:

- `packages/agent-runner/` stays a placeholder package.
- `packages/server/src/features/sandboxExecution.ts` keeps `executeInSandbox` as a stub while `runCliCommand` remains the supported execution path.
- `packages/server/src/features/sdkGeneration.ts` stays a stub and does not start a generator pipeline.

## Follow-Up

No follow-on ExecPlan is required because nothing received PROCEED. The next implementation work should stay in the server package and continue to follow the existing workflow primitive pattern.
