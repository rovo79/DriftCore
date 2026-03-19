import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createState } from "./testUtils.js";
import { clearPreviewTokensForTests } from "../features/writeLifecycle.js";
import {
  runModuleScaffoldApply,
  runModuleScaffoldPreview,
  runModuleScaffoldVerify,
} from "../features/workflows/index.js";
import { createWriteFixture } from "./writeTestUtils.js";

describe("module scaffold write workflow", () => {
  beforeEach(() => {
    clearPreviewTokensForTests();
  });

  it("previews and applies a minimal module scaffold", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);
      const preview = await runModuleScaffoldPreview(state, {
        machine_name: "acme_blog",
        target_type: "module",
      });

      assert.equal(preview.status, "ok");
      assert.equal(preview.data?.preview.target_directory, "web/modules/custom/acme_blog");
      assert.ok(preview.data?.preview.files.some((file) => file.path === "acme_blog.info.yml"));
      assert.ok(preview.data?.preview.files.some((file) => file.path === "src/Controller/AcmeBlogController.php"));

      const apply = await runModuleScaffoldApply(state, {
        machine_name: "acme_blog",
        target_type: "module",
        preview_token: preview.data?.preview_token,
      });

      assert.equal(apply.status, "ok");
      assert.equal(apply.data?.result.target_directory, "web/modules/custom/acme_blog");
      assert.ok(
        apply.data?.changes.some((change) => change.type === "file_created" && change.target.endsWith("acme_blog.info.yml")),
      );

      const targetDir = path.join(fixture.projectRoot, "web", "modules", "custom", "acme_blog");
      assert.equal(fs.existsSync(path.join(targetDir, "acme_blog.info.yml")), true);
      assert.equal(fs.existsSync(path.join(targetDir, "acme_blog.module")), true);
      assert.equal(fs.existsSync(path.join(targetDir, "acme_blog.routing.yml")), true);
      assert.equal(fs.existsSync(path.join(targetDir, "src", "Controller", "AcmeBlogController.php")), true);

      const verify = await runModuleScaffoldVerify(state, {
        machine_name: "acme_blog",
        target_type: "module",
      });
      assert.equal(verify.status, "ok");
      assert.equal(verify.data?.verified, true);
      assert.equal(verify.data?.verification.files.every((file) => file.exists && file.non_empty && file.valid), true);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects apply without a preview token", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);
      const response = await runModuleScaffoldApply(state, {
        machine_name: "acme_news",
        target_type: "module",
      });

      assert.equal(response.status, "error");
      assert.equal(response.error?.code, "E_PREVIEW_REQUIRED");
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects path traversal outside custom module directories", async () => {
    const fixture = createWriteFixture();
    try {
      fixture.config.customModuleDirs = ["../escape"];
      const state = createState(fixture.config);

      const preview = await runModuleScaffoldPreview(state, {
        machine_name: "acme_safe",
        target_type: "module",
      });
      assert.equal(preview.status, "error");
      assert.equal(preview.error?.code, "E_PATH_UNSAFE");
    } finally {
      fixture.cleanup();
    }
  });
});
