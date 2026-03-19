import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runConfigDriftAssessment } from "../features/workflows/index.js";
import { createState, createTempProject } from "./testUtils.js";

describe("config drift assessment workflow", () => {
  it("reports changed config items when Drush sees drift", async () => {
    const { config, cleanup, projectRoot } = createTempProject({
      createConfigSyncDir: "project",
    });
    try {
      fs.writeFileSync(
        path.join(projectRoot, "config", "sync", "system.site.yml"),
        "name: Example\n",
        "utf8",
      );

      const response = await runConfigDriftAssessment(createState(config), {
        runStatus: async () => ({
          status: "ok",
          data: {
            drupal_version: "11.1.5",
            php_version: "8.4.14",
            database_driver: "sqlite",
            site_path: "sites/default",
            details: {
              "config-sync": path.join(projectRoot, "config", "sync"),
            },
          },
        }),
        runConfigStatus: async () => ({
          status: "ok",
          data: [
            { name: "core.extension", state: "changed" as const },
            { name: "system.site", state: "new" as const },
          ],
        }),
      });

      assert.equal(response.status, "ok");
      assert.equal(response.data?.sync_directory, "config/sync");
      assert.equal(response.data?.sync_directory_exists, true);
      assert.equal(response.data?.drift_detected, true);
      assert.deepEqual(response.data?.changed_items.map((item) => item.name), [
        "core.extension",
        "system.site",
      ]);
      assert.ok(response.data?.suggested_commands.includes("drush config:import -y"));
      assert.ok(response.data?.suggested_commands.includes("drush cache:rebuild"));
      assert.match(response.data?.summary ?? "", /drift/i);
    } finally {
      cleanup();
    }
  });

  it("degrades to filesystem-only data when Drush config status is unavailable", async () => {
    const { config, cleanup } = createTempProject({
      createConfigSyncDir: "project",
      composerRequire: {
        "drupal/config_split": "^2.0",
      },
      composerPackages: [
        {
          name: "drupal/config_split",
          version: "2.0.0",
          type: "drupal-module",
        },
      ],
    });
    try {
      fs.writeFileSync(
        path.join(config.drupalRoot, "..", "config", "sync", "system.site.yml"),
        "name: Example\n",
        "utf8",
      );
      const response = await runConfigDriftAssessment(createState(config), {
        runStatus: async () => ({
          status: "error",
          error: {
            code: "E_DRUSH_NOT_FOUND",
            message: "Drush executable was not found.",
          },
        }),
      });

      assert.equal(response.status, "degraded");
      assert.equal(response.data?.sync_directory, "config/sync");
      assert.equal(response.data?.sync_directory_exists, true);
      assert.equal(response.data?.has_config_split, true);
      assert.deepEqual(response.data?.changed_items, []);
      assert.equal(response.error?.code, "E_DRUSH_NOT_FOUND");
    } finally {
      cleanup();
    }
  });

  it("returns not_configured when no project configuration is available", async () => {
    const response = await runConfigDriftAssessment(createState(null));
    assert.equal(response.status, "not_configured");
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });
});
