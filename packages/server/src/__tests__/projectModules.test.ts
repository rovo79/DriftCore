import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProjectModules } from "../features/projectModules.js";
import { createState, createTempProject } from "./testUtils.js";

describe("project modules resource", () => {
  it("returns drush-derived module and theme state", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await getProjectModules(createState(config), {
        runPml: async () => ({
          status: "ok",
          data: {
            modules: [
              { name: "node", type: "core", status: "enabled" },
              { name: "token", type: "contrib", status: "enabled" },
              { name: "acme_blog", type: "custom", status: "disabled" },
            ],
            themes: [{ name: "claro", type: "core", status: "enabled" }],
          },
        }),
      });

      assert.equal(response.status, "ok");
      assert.equal(response.data?.summary.total, 4);
      assert.equal(response.data?.summary.enabled, 3);
      assert.equal(response.data?.summary.custom, 1);
      assert.equal(response.data?.modules.find((entry) => entry.name === "acme_blog")?.type, "custom");
      assert.equal(response.data?.themes[0]?.name, "claro");
    } finally {
      cleanup();
    }
  });

  it("degrades to filesystem-only custom extension discovery when drush is unavailable", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await getProjectModules(createState(config), {
        runPml: async () => ({
          status: "error",
          error: {
            code: "E_DRUSH_NOT_FOUND",
            message: "Drush executable was not found.",
          },
        }),
      });

      assert.equal(response.status, "degraded");
      assert.equal(response.error?.code, "E_DRUSH_NOT_FOUND");
      assert.equal(response.data?.modules[0]?.status, "unknown");
      assert.equal(response.data?.modules[0]?.type, "custom");
      assert.match(response.data?.modules[0]?.path ?? "", /web\/modules\/custom\/acme_blog$/);
      assert.equal(response.data?.themes[0]?.status, "unknown");
    } finally {
      cleanup();
    }
  });

  it("returns not_configured when server config is missing", async () => {
    const response = await getProjectModules(createState(null));
    assert.equal(response.status, "not_configured");
    assert.equal(response.error?.code, "E_CONFIG_INVALID_ROOT");
  });
});
