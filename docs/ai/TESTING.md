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

## Completed Task 12 evidence: MCP Inspector CLI

Inspector is an external validation tool, not a production or development dependency of DriftCore. Install the tested version in a temporary directory and run from the repository root:

```sh
INSPECTOR_DIR=$(mktemp -d)
npm install --prefix "$INSPECTOR_DIR" --ignore-scripts --no-audit --no-fund --save-exact @modelcontextprotocol/inspector@2.10.1
npm --prefix packages/server run integration:inspector -- "$INSPECTOR_DIR/node_modules/.bin/mcp-inspector"
rm -rf "$INSPECTOR_DIR"
```

Inspector 2.10.1 requires Node >=22.19.0; this does not change DriftCore's Node >=20 contract. The harness reuses the packed consumer proof, installs the tarball with production dependencies only, and launches eight Inspector CLI processes. Each uses `--cli --config <temporary-config> --server driftcore --format json --method <method>` with the installed executable and an explicit fixture project root. Secrets use Inspector's memory store. It checks exact discovery, all four resource reads, upgrade assessment, and an unexpired cache rebuild preview token. No apply tool is called. Consumers, config, fixtures, and tarballs are removed even on failure.

Recorded at head `a70d0d82a797a9a3571424534490f472d5daa5f0` on Linux, Node 24.19.0/npm 11.9.0 with Inspector 2.10.1, all eight calls exited 0. Manifest, checks, and config layout returned `ok`; modules and upgrade assessment returned `degraded` because the fixture has no Drush or Composer executable. This proves protocol access and honest fallback behavior, not successful Drupal bootstrap or live upgrade analysis. The separate SDK proof checks protocol-only stdout, operational stderr, and unsignaled server exit 0 after EOF; Inspector CLI exit 0 alone does not establish the server's exit status.

## Final acceptance still pending

Task 12 remains partial. There are two independent external acceptance gates:

| Gate | Current status | Required evidence |
|---|---|---|
| Manual Inspector web UI | Unperformed | Human observation of initialization, discovery, resource/tool responses, preview token, and disconnect/shutdown in the web UI |
| Real Drupal project | Blocked: no real Drupal Composer project, PHP, Composer, or Drush in the inspected workspace | Installed packed executable against a working non-production site, with responses compared to independent site facts |

CLI validation closes neither gate. A synthetic fixture may be used for the manual UI gate; it cannot close real-project acceptance. A manual web UI session against a real site can supply evidence for both, but each gate must be recorded separately. Keep the PR draft until both results have been reviewed and final closeout recorded.

### Shared packed-consumer preparation

Prerequisites: a local checkout of the PR head, npm with package download access, Node >=22.19.0 for Inspector 2.10.1, and a browser for the manual UI. DriftCore itself requires Node >=20. Run from the repository root in one shell; retain these variables for the gate commands below. No registry publication is required.

```sh
DRIFTCORE_REPO=$(pwd -P)
git rev-parse HEAD
node --version
npm --version
npm --prefix packages/server ci
ACCEPTANCE_DIR=$(mktemp -d)
mkdir -p "$ACCEPTANCE_DIR/consumer" "$ACCEPTANCE_DIR/inspector"
(cd "$DRIFTCORE_REPO/packages/server" && npm pack --pack-destination "$ACCEPTANCE_DIR")
npm install --prefix "$ACCEPTANCE_DIR/consumer" --omit=dev --ignore-scripts --no-audit --no-fund "$ACCEPTANCE_DIR/driftcore-server-0.2.0.tgz"
npm install --prefix "$ACCEPTANCE_DIR/inspector" --ignore-scripts --no-audit --no-fund --save-exact @modelcontextprotocol/inspector@2.10.1
DRIFTCORE_BIN="$ACCEPTANCE_DIR/consumer/node_modules/.bin/driftcore"
INSPECTOR_BIN="$ACCEPTANCE_DIR/inspector/node_modules/.bin/mcp-inspector"
```

The tarball name is for the current 0.2.0 package. Record the commit, runtime/tool versions, tarball, and exact commands with the eventual acceptance observations; do not attach the earlier CLI result to a different head as a new run.

### Gate 1: manual Inspector web UI

Use a disposable synthetic fixture for this gate when a real site is unavailable. PHP, Composer, Drush, and a database are not prerequisites for this fixture session; degraded responses must be recorded honestly.

```sh
UI_PROJECT="$ACCEPTANCE_DIR/ui-fixture"
mkdir -p "$UI_PROJECT/web/core" "$UI_PROJECT/config/sync"
printf '%s\n' '{"name":"driftcore/manual-ui-fixture","require":{"drupal/core-recommended":"^10.0"}}' > "$UI_PROJECT/composer.json"
node --input-type=module -e 'import fs from "node:fs"; const [file, command, root] = process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({mcpServers:{driftcore:{command,args:["--project-root",root]}}}, null, 2));' "$ACCEPTANCE_DIR/ui.json" "$DRIFTCORE_BIN" "$UI_PROJECT"
MCP_INSPECTOR_SECRET_STORE=memory "$INSPECTOR_BIN" --web --config "$ACCEPTANCE_DIR/ui.json" --server driftcore
```

Open the local URL printed by Inspector and connect to `driftcore` over STDIO. In the web UI, confirm initialization, exactly four project resources and sixteen tools, and read all four resources listed below. Check that the manifest selects `UI_PROJECT`; call `drift_upgrade_assessment` and `drift_cache_rebuild_preview` with empty arguments (`{}`). Inspect the preview's nonempty `preview_token` and future `expires_at`. Do not call any apply tool. Record observed envelopes, degraded/error explanations, and screenshots or session notes. Disconnect in the UI, stop Inspector with Ctrl-C, and confirm no child DriftCore process remains. Record shutdown separately; the earlier SDK EOF result does not establish this session's shutdown behavior.

### Gate 2: real Drupal project acceptance

Prerequisites: an available non-production Composer-managed Drupal project with `composer.json`, `composer.lock`, installed dependencies, a recognized core directory (`web/core`, `docroot/core`, or `core`), compatible PHP on PATH, working Composer and project-local `vendor/bin/drush`, and a configured reachable database. The site must bootstrap through Drush. For this procedure, expose Composer on PATH; run everything on the same host with the same environment as Inspector. Container-only DDEV/Lando access is outside this gate's supported setup.

Replace the project path, and set the actual Drupal document root (use `docroot` or the project root instead of `web` if applicable). These preflight commands gather independent facts without installing dependencies or rebuilding caches:

```sh
REAL_PROJECT=/absolute/path/to/non-production-drupal-project
DRUPAL_ROOT="$REAL_PROJECT/web"
test -f "$REAL_PROJECT/composer.json"
test -f "$REAL_PROJECT/composer.lock"
test -d "$DRUPAL_ROOT/core"
php --version
composer --version
"$REAL_PROJECT/vendor/bin/drush" --version
(cd "$DRUPAL_ROOT" && "$REAL_PROJECT/vendor/bin/drush" status --format=json)
(cd "$DRUPAL_ROOT" && "$REAL_PROJECT/vendor/bin/drush" pm:list --format=json)
(cd "$REAL_PROJECT" && composer show --locked --format=json)
(cd "$REAL_PROJECT" && composer outdated --direct --format=json)
node --input-type=module -e 'import fs from "node:fs"; const [file, command, root] = process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({mcpServers:{driftcore:{command,args:["--project-root",root]}}}, null, 2));' "$ACCEPTANCE_DIR/real-project.json" "$DRIFTCORE_BIN" "$REAL_PROJECT"
MCP_INSPECTOR_SECRET_STORE=memory "$INSPECTOR_BIN" --web --config "$ACCEPTANCE_DIR/real-project.json" --server driftcore
```

In that web UI session, confirm initialization and exact discovery, read each resource, and call each tool below with empty arguments (`{}`):

| Resource URI | Tool name |
|---|---|
| `driftcore://project/manifest` | `drift_drush_status` |
| `driftcore://project/modules` | `drift_drush_pml` |
| `driftcore://project/config-layout` | `drift_composer_info` |
| `driftcore://project/checks` | `drift_upgrade_assessment` |
| | `drift_cache_rebuild_preview` |

Compare the manifest's `project_root` and Drupal root, core version, module list, Composer manifest/lock summary, and upgrade findings with the preflight output and actual project/config files. Preserve each exact envelope (`status`, `data`, and any `error`) and explain any degraded/error/timeout/not-configured response against independent facts. A zero Inspector exit code or an unexplained degraded result is insufficient evidence of live acceptance. Check the preview token and expiration without invoking apply. Disconnect, stop Inspector, and record child-process shutdown. Record failures as unresolved acceptance findings rather than declaring the gate passed.

After recording evidence outside the temporary directory and finishing both sessions, clean up:

```sh
rm -rf "$ACCEPTANCE_DIR"
```

Node 20 has not been executed locally. Node 20 execution, Streamable HTTP, DDEV/Lando, registry publication, and legacy removal remain separately deferred; this documentation closeout does not implement or validate them.
