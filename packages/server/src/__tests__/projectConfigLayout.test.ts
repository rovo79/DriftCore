import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProjectConfigLayout } from "../features/projectConfigLayout.js";
import { createState, createTempProject } from "./testUtils.js";

describe("project config layout resource", () => {
  it("detects the config sync directory from drush status output", async () => {
    const { config, cleanup, projectRoot } = createTempProject({
      createConfigSyncDir: "project",
    });
    try {
      const response = await getProjectConfigLayout(createState(config), {
        runStatus: async () => ({
          status: "ok",
          data: {
            drupal_version: "11.1.4",
            php_version: "8.4.14",
            database_driver: "sqlite",
            site_path: "sites/default",
            details: {
              "config-sync": `${projectRoot}/config/sync`,
            },
          },
        }),
      });

      assert.equal(response.status, "ok");
      assert.equal(response.data?.sync_directory, "config/sync");
      assert.equal(response.data?.detection_method, "drush");
      assert.equal(response.data?.has_config_split, false);
    } finally {
      cleanup();
    }
  });

  it("degrades when only partial config layout indicators are available", async () => {
    const { config, cleanup } = createTempProject({
      composerRequire: { "drupal/config_split": "^2.0" },
      composerPackages: [{ name: "drupal/config_split", version: "2.0.0", type: "drupal-module" }],
      createSettingsPhp: true,
      createSettingsLocal: true,
      createDrushSitesDir: true,
      envFiles: [".env.local"],
    });
    try {
      const response = await getProjectConfigLayout(createState(config), {
        runStatus: async () => ({
          status: "error",
          error: {
            code: "E_JSON_PARSE",
            message: "Failed to parse Drush status output as JSON",
          },
        }),
      });

      assert.equal(response.status, "degraded");
      assert.equal(response.data?.sync_directory, null);
      assert.equal(response.data?.has_config_split, true);
      assert.equal(response.data?.detection_method, "none");
      assert.ok(response.data?.environment_indicators.includes(".env.local"));
      assert.ok(response.data?.environment_indicators.includes("sites/default/settings.local.php"));
      assert.equal(response.error?.code, "E_JSON_PARSE");
    } finally {
      cleanup();
    }
  });

  it("returns not_configured when no config sync setup is detectable", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await getProjectConfigLayout(createState(config), {
        runStatus: async () => ({
          status: "error",
          error: {
            code: "E_DRUSH_NOT_FOUND",
            message: "Drush executable was not found.",
          },
        }),
      });

      assert.equal(response.status, "not_configured");
      assert.equal(response.error?.code, "E_CONFIG_SYNC_NOT_DETECTED");
    } finally {
      cleanup();
    }
  });
});
