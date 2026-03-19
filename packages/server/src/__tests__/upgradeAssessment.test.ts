import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runUpgradeAssessment } from "../features/workflows/index.js";
import { createState, createTempProject } from "./testUtils.js";

describe("upgrade assessment workflow", () => {
  it("classifies risk levels and suggests concrete follow-up commands", async () => {
    const { config, cleanup, projectRoot } = createTempProject();
    try {
      fs.writeFileSync(
        path.join(projectRoot, "composer.lock"),
        JSON.stringify(
          {
            packages: [
              {
                name: "drupal/core-recommended",
                version: "10.2.0",
                type: "drupal-core",
              },
              {
                name: "drupal/token",
                version: "1.11.0",
                type: "drupal-module",
              },
              {
                name: "psr/log",
                version: "3.0.0",
                type: "library",
              },
            ],
          },
          null,
          2,
        ),
        "utf8",
      );

      const response = await runUpgradeAssessment(createState(config), {
        runOutdated: async () => ({
          status: "ok",
          data: {
            packages: [
              {
                name: "drupal/core-recommended",
                current_version: "10.2.0",
                latest_version: "11.0.0",
                constraint: "^10.2",
                package_type: "drupal-core",
                latest_status: "update-possible",
              },
              {
                name: "drupal/token",
                current_version: "1.11.0",
                latest_version: "1.12.0",
                constraint: "^1.11",
                package_type: "drupal-module",
                latest_status: "semver-safe-update",
              },
              {
                name: "psr/log",
                current_version: "3.0.0",
                latest_version: "3.0.1",
                constraint: "^3.0",
                package_type: "library",
                latest_status: "semver-safe-update",
              },
            ],
          },
        }),
      });

      assert.equal(response.status, "ok");
      assert.equal(response.data?.total_outdated, 3);
      assert.equal(response.data?.candidates[0].risk, "high");
      assert.equal(response.data?.candidates[1].risk, "medium");
      assert.equal(response.data?.candidates[2].risk, "low");
      assert.ok(response.data?.suggested_commands.includes("composer update drupal/core-recommended --with-dependencies"));
      assert.ok(response.data?.suggested_commands.includes("composer update drupal/token --with-dependencies"));
      assert.ok(response.data?.suggested_commands.includes("composer update psr/log --with-dependencies"));
      assert.ok(response.data?.suggested_commands.includes("drush updatedb"));
      assert.ok(response.data?.suggested_commands.includes("drush cache:rebuild"));
      assert.match(response.data?.summary ?? "", /outdated package/);
    } finally {
      cleanup();
    }
  });

  it("degrades when composer outdated inspection is unavailable", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runUpgradeAssessment(createState(config), {
        runOutdated: async () => ({
          status: "error",
          error: {
            code: "E_COMPOSER_NOT_FOUND",
            message: "Composer executable was not found.",
          },
        }),
      });

      assert.equal(response.status, "degraded");
      assert.equal(response.data?.total_outdated, 0);
      assert.deepEqual(response.data?.candidates, []);
      assert.equal(response.error?.code, "E_COMPOSER_NOT_FOUND");
    } finally {
      cleanup();
    }
  });

  it("returns not_configured when no project configuration is available", async () => {
    const response = await runUpgradeAssessment(createState(null));
    assert.equal(response.status, "not_configured");
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });
});
