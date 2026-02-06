# SECURITY_AND_RISKS

## Existing safety mechanisms

- **Command allowlisting by construction**
  - Drush and Composer tools execute fixed command/arg sets; transport does not accept arbitrary flags.
- **No shell execution path**
  - CLI runner uses `spawn(..., shell: false)`.
- **Timeout + process termination**
  - Configurable timeouts for Drush/Composer calls, with SIGKILL on timeout.
- **Concurrency control**
  - `maxParallelCli` defaults to `1` to reduce contention and limit parallel subprocess risk.
- **Structured error handling**
  - Failures map to explicit status/error payloads to avoid crashes and opaque failures.
- **Non-write posture tested**
  - Dedicated test verifies no tool invocation modifies a sentinel project file.

## Current risks / gaps

- **No auth on HTTP endpoints**
  - API appears open by default (`/health`, `/tools`, tool endpoints).
- **Potential sensitive path leakage**
  - Errors/diagnostics include command, cwd, and filesystem paths.
- **Resource exposure**
  - `/composer/info` and `project_manifest` can expose dependency metadata and local project structure.
- **Process isolation is basic**
  - Subprocesses run on host/container with cwd/env controls but without deeper sandboxing.
- **Placeholder sandbox execution API**
  - `executeInSandbox` is currently a stub; future implementation is a high-risk area.
- **No built-in rate limiting or request size controls**
  - Could enable abuse in exposed environments.

## Recommended hardening backlog

- Add authn/authz (token or mTLS) before exposing HTTP transport beyond localhost.
- Add optional response redaction mode for paths/stderr diagnostics.
- Add endpoint-level rate limiting and time-budget controls.
- Add explicit allowlist checks for resolved binary paths.
- Add contract tests for redaction, timeout behavior, and malformed CLI output resilience.
- Document threat model for local-dev vs shared-host deployment.

## Assumptions

- Security posture is assessed from application code only; external proxy/firewall controls are unknown.
- No secret scanning or SAST configuration is visible in repository contents.
