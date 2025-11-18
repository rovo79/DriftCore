import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ServerConfig, ServerState } from "../types.js";
import { getProjectManifest } from "../features/projectManifest.js";

function createTempProject(): { config: ServerConfig; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-manifest-"));
  const projectRoot = tmpDir;
  const drupalRoot = path.join(projectRoot, "web");

  fs.mkdirSync(drupalRoot, { recursive: true });

  const composerJson = {
    name: "acme/site",
    type: "project",
    require: {
      "drupal/core-recommended": "^11.1",
      "drupal/token": "^1.11",
    },
  };
  fs.writeFileSync(
    path.join(projectRoot, "composer.json"),
    JSON.stringify(composerJson, null, 2),
    "utf8",
  );

  const composerLock = {
    packages: [
      {
        name: "drupal/core-recommended",
        version: "11.1.4",
      },
    ],
  };
  fs.writeFileSync(
    path.join(projectRoot, "composer.lock"),
    JSON.stringify(composerLock, null, 2),
    "utf8",
  );

  const customModuleDir = path.join(projectRoot, "web", "modules", "custom", "acme_blog");
  fs.mkdirSync(customModuleDir, { recursive: true });

  const config: ServerConfig = {
    drupalRoot,
    customModuleDirs: ["web/modules/custom"],
    customThemeDirs: ["web/themes/custom"],
    cacheTtlMs: { projectManifest: 5000, pml: 5000 },
  };

  const cleanup = () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  return { config, cleanup };
}

describe("project manifest", () => {
  it("builds a manifest matching the configured project", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const state: ServerState = {
        resources: [],
        tools: [],
        logger: console,
        config,
        runOperation: async (_meta, executor) => executor(),
      };

      const response = await getProjectManifest(state);
      assert.equal(response.status, "ok");
      assert.ok(response.data, "expected data in ok response");

      const data = response.data!;
      assert.equal(data.schema_version, "0.1.0");
      assert.equal(data.drupal_root, config.drupalRoot);
      assert.equal(data.drupal_core_version, "11.1.4");
      assert.equal(data.project_type, "drupal-recommended-project");

      assert.equal(data.composer.status, "ok");
      assert.equal(data.composer.name, "acme/site");
      assert.ok(data.composer.require);
      assert.equal(
        data.composer.require && data.composer.require["drupal/core-recommended"],
        "^11.1",
      );

      assert.ok(Array.isArray(data.custom_modules));
      const moduleNames = data.custom_modules.map((m) => m.name);
      assert.ok(moduleNames.includes("acme_blog"));

      const modulePaths = data.custom_modules.map((m) => m.path);
      assert.ok(modulePaths.some((p) => p.endsWith("web/modules/custom/acme_blog")));

      assert.ok(Array.isArray(data.custom_themes));
    } finally {
      cleanup();
    }
  });

  it("returns not_configured when no server config is present", async () => {
    const state: ServerState = {
      resources: [],
      tools: [],
      logger: console,
      config: null,
      configError: {
        code: "E_CONFIG_INVALID_ROOT",
        message: "invalid",
      },
      runOperation: async (_meta, executor) => executor(),
    };

    const response = await getProjectManifest(state);
    assert.equal(response.status, "not_configured");
    assert.ok(response.error);
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });

  it("degrades when composer metadata is incomplete", async () => {
    const { config, cleanup } = createTempProject();
    try {
      fs.unlinkSync(path.join(path.dirname(config.drupalRoot), "composer.lock"));

      const state: ServerState = {
        resources: [],
        tools: [],
        logger: console,
        config,
        runOperation: async (_meta, executor) => executor(),
      };

      const response = await getProjectManifest(state);
      assert.equal(response.status, "degraded");
      assert.ok(response.data);
      assert.ok(response.error);
      assert.equal(response.error?.code, "E_MANIFEST_INCOMPLETE");
    } finally {
      cleanup();
    }
  });
});
