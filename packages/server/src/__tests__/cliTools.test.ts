import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ServerConfig, ServerState } from "../types.js";
import {
  runDrushStatus,
  runDrushPml,
} from "../features/drushTools.js";
import {
  runComposerInfo,
  runComposerOutdated,
} from "../features/composerTools.js";
import type {
  CliExecutionOptions,
  CliExecutionResult,
} from "../features/sandboxExecution.js";

type RunnerStub = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

function createTempProject(): { config: ServerConfig; cleanup: () => void; projectRoot: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-cli-"));
  const projectRoot = tmpDir;
  const drupalRoot = path.join(projectRoot, "web");
  fs.mkdirSync(drupalRoot, { recursive: true });

  const composerJson = {
    name: "acme/site",
    require: {
      "drupal/core-recommended": "^11.1",
      "drupal/token": "^1.11",
    },
  };
  fs.writeFileSync(
    path.join(projectRoot, "composer.json"),
    JSON.stringify(composerJson, null, 2),
  );

  const composerLock = {
    packages: [
      { name: "drupal/core-recommended", version: "11.1.4", type: "drupal-core" },
      { name: "drupal/token", version: "1.11.0", type: "drupal-module" },
    ],
  };
  fs.writeFileSync(
    path.join(projectRoot, "composer.lock"),
    JSON.stringify(composerLock, null, 2),
  );

  const config: ServerConfig = {
    drupalRoot,
    customModuleDirs: ["web/modules/custom"],
    customThemeDirs: ["web/themes/custom"],
    cacheTtlMs: { projectManifest: 0, pml: 0 },
  };

  return {
    config,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
    projectRoot,
  };
}

function createState(config: ServerConfig): ServerState {
  return {
    resources: [],
    tools: [],
    logger: console,
    config,
    runOperation: async (_meta, executor) => executor(),
  };
}

function makeRunnerStub(stdout: string): RunnerStub {
  return async () => ({
    stdout,
    stderr: "",
    exitCode: 0,
    timedOut: false,
    durationMs: 5,
  });
}

describe("drift.drush tools", () => {
  it("normalizes drush status output", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const runner = makeRunnerStub(
        JSON.stringify({
          "drupal-version": "11.1.5",
          "php-version": "8.4.14",
          "db-driver": "sqlite",
          site: "sites/default",
        }),
      );
      const response = await runDrushStatus(createState(config), runner);
      assert.equal(response.status, "ok");
      assert.equal(response.data?.drupal_version, "11.1.5");
      assert.equal(response.data?.php_version, "8.4.14");
      assert.equal(response.data?.database_driver, "sqlite");
      assert.equal(response.data?.site_path, "sites/default");
      assert.ok(response.data?.details["drupal-version"]);
    } finally {
      cleanup();
    }
  });

  it("parses pm:list output into module/theme descriptors", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const runner = makeRunnerStub(
        JSON.stringify({
          modules: {
            node: { status: "Enabled", package: "Core", path: "core/modules/node" },
            token: {
              status: "Enabled",
              package: "Contributed modules",
              path: "web/modules/contrib/token",
            },
          },
          themes: {
            claro: { status: "Enabled", package: "Core", path: "core/themes/claro" },
          },
        }),
      );
      const response = await runDrushPml(createState(config), runner);
      assert.equal(response.status, "ok");
      const modules = response.data?.modules ?? [];
      const node = modules.find((m) => m.name === "node");
      assert.equal(node?.type, "core");
      const tokenModule = modules.find((m) => m.name === "token");
      assert.equal(tokenModule?.type, "contrib");
      const themes = response.data?.themes ?? [];
      assert.equal(themes[0]?.name, "claro");
    } finally {
      cleanup();
    }
  });
});

describe("composer tools", () => {
  it("reads composer manifest and lock summary", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerInfo(createState(config));
      assert.equal(response.status, "ok");
      assert.equal(response.data?.manifest.name, "acme/site");
      assert.ok(response.data?.manifest.require?.["drupal/token"]);
      assert.ok(response.data?.lock_summary?.packages?.length);
    } finally {
      cleanup();
    }
  });

  it("parses composer outdated output", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const runner: RunnerStub = makeRunnerStub(
        `Cannot create cache directory
{"installed":[{"name":"drupal/token","version":"1.11.0","latest":"1.12.0","latest-status":"semver-safe-update"}]}`,
      );
      const response = await runComposerOutdated(createState(config), runner);
      assert.equal(response.status, "ok");
      const pkg = response.data?.packages[0];
      assert.equal(pkg?.name, "drupal/token");
      assert.equal(pkg?.constraint, "^1.11");
      assert.equal(pkg?.package_type, "drupal-module");
      assert.equal(pkg?.latest_status, "semver-safe-update");
    } finally {
      cleanup();
    }
  });
});
