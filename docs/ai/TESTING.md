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

## MCP Inspector CLI acceptance

Inspector is an external validation tool, not a production or development dependency of DriftCore. Install the tested version in a temporary directory and run from the repository root:

```sh
INSPECTOR_DIR=$(mktemp -d)
npm install --prefix "$INSPECTOR_DIR" --ignore-scripts --no-audit --no-fund --save-exact @modelcontextprotocol/inspector@2.10.1
npm --prefix packages/server run integration:inspector -- "$INSPECTOR_DIR/node_modules/.bin/mcp-inspector"
rm -rf "$INSPECTOR_DIR"
```

Inspector 2.10.1 requires Node >=22.19.0; this does not change DriftCore's Node >=20 contract. The harness reuses the packed consumer proof, installs the tarball with production dependencies only, and launches eight Inspector CLI processes. Each uses `--cli --config <temporary-config> --server driftcore --format json --method <method>` with the installed executable and an explicit fixture project root. Secrets use Inspector's memory store. It checks exact discovery, all four resource reads, upgrade assessment, and an unexpired cache rebuild preview token. No apply tool is called. Consumers, config, fixtures, and tarballs are removed even on failure.

On Linux, Node 24.19.0/npm 11.9.0 with Inspector 2.10.1, all eight calls exited 0. Manifest, checks, and config layout returned `ok`; modules and upgrade assessment returned `degraded` because the fixture has no Drush or Composer executable. This proves protocol access and honest fallback behavior, not successful Drupal bootstrap or live upgrade analysis. The separate SDK proof checks protocol-only stdout, operational stderr, and unsignaled server exit 0 after EOF; Inspector CLI exit 0 alone does not establish the server's exit status.

## Final acceptance still pending

The plan's manual Inspector web UI session remains unperformed. CLI acceptance is additional evidence, not an accepted replacement for that requirement. Real-project acceptance is blocked here: no real Drupal Composer project, PHP, Composer, or Drush is available in the inspected workspace. Node 20 has not been executed locally.

For real-project acceptance, use an available non-production Drupal project with working PHP, Composer, Drush, and its database. Install the packed artifact into a separate consumer, launch the installed executable with `--project-root` for that project, and use Inspector to confirm the manifest points to it, read all four resources, call `drift_drush_status`, `drift_drush_pml`, `drift_composer_info`, `drift_upgrade_assessment`, and `drift_cache_rebuild_preview`. Record exact envelopes and any degraded results against independent project facts. Do not invoke apply. Confirm clean shutdown and keep the PR draft until manual and real-project results have been reviewed.
