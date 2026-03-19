import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProjectChecks } from "../features/projectChecks.js";
import { createState, createTempProject } from "./testUtils.js";

describe("project checks resource", () => {
  it("reports available capabilities when binaries and config sync are present", async () => {
    const { config, cleanup } = createTempProject({
      createConfigSyncDir: "project",
    });
    try {
      const response = await getProjectChecks(
        createState(config, {
          binaryValidation: {
            drush: { resolved: "/usr/local/bin/drush", exists: true },
            composer: { resolved: "/usr/local/bin/composer", exists: true },
          },
        }),
        {
          runStatus: async () => ({
            status: "ok",
            data: {
              drupal_version: "11.1.4",
              php_version: "8.4.14",
              database_driver: "sqlite",
              site_path: "sites/default",
              details: {
                "config-sync": "config/sync",
              },
            },
          }),
        },
      );

      assert.equal(response.status, "ok");
      assert.equal(response.data?.drush_available, true);
      assert.equal(response.data?.composer_available, true);
      assert.equal(response.data?.drupal_root_valid, true);
      assert.equal(response.data?.composer_json_present, true);
      assert.equal(response.data?.config_sync_detected, true);
      assert.equal(response.data?.capabilities.can_inspect_modules, true);
      assert.equal(response.data?.capabilities.can_run_composer, true);
      assert.deepEqual(response.data?.warnings, []);
    } finally {
      cleanup();
    }
  });

  it("warns when binaries are missing and config sync cannot be detected", async () => {
    const { config, cleanup } = createTempProject({
      createSettingsPhp: true,
    });
    try {
      const response = await getProjectChecks(createState(config));
      assert.equal(response.status, "ok");
      assert.equal(response.data?.drush_available, false);
      assert.equal(response.data?.composer_available, false);
      assert.equal(response.data?.config_sync_detected, false);
      assert.ok(response.data?.warnings.includes("Drush executable is not available for project inspection."));
      assert.ok(response.data?.warnings.includes("Composer executable is not available for project inspection."));
      assert.ok(response.data?.warnings.includes("Config sync directory could not be detected."));
      assert.equal(response.data?.capabilities.can_inspect_modules, false);
      assert.equal(response.data?.capabilities.can_assess_config, true);
    } finally {
      cleanup();
    }
  });

  it("reports configuration errors even when the server is not configured", async () => {
    const response = await getProjectChecks(createState(null));
    assert.equal(response.status, "ok");
    assert.equal(response.data?.drupal_root_valid, false);
    assert.equal(response.data?.composer_json_present, false);
    assert.equal(response.data?.config_sync_detected, false);
    assert.ok(
      response.data?.warnings.includes("DriftCore configuration is missing or invalid"),
    );
    assert.equal(response.data?.capabilities.can_read_project_manifest, false);
  });
});
