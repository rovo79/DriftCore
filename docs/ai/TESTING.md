# Testing

From the repository root:

```sh
npm --prefix packages/server run lint
npm --prefix packages/server run build
npm --prefix packages/server test
npm --prefix packages/server run integration
npm --prefix packages/server run pack:check
npm --prefix packages/server run integration:mcp
```

`lint` type-checks without output. `build` clears `dist` before emitting TypeScript. `test` builds and runs compiled `node:test` suites. `integration` builds and checks the Legacy REST API routes. `pack:check` inspects the npm artifact without publishing it.

`integration:mcp` packs the executable, installs the tarball with production dependencies into a fresh temporary consumer, and uses an official SDK client to initialize it. It checks all four resources and sixteen tools, reads the manifest, calls read-only Composer inspection, tests explicit and discovered project roots, confirms protocol-only stdout and clean EOF exit, then deletes its temporary artifacts. It does not need a running Drupal database.

The unit tests include CLI/config precedence, exact MCP registration, resource and tool result mappings, guarded preview/apply/verify behavior, security boundaries, legacy action-STDIO compatibility, and a real-process regression for the legacy output path. The existing GitHub Actions workflow runs lint, build, and unit tests on Node 20. HTTP and packed consumer integrations are not CI gates in that workflow.

## Final acceptance still pending

Task 12 calls for a manual MCP Inspector session using the packed artifact and a non-production Drupal fixture. It also requires real-project acceptance and final review of package contents and stdout discipline. Passing the automated packed consumer smoke test does not record that manual Inspector result.
