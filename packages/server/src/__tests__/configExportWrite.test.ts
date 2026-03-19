import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createState } from "./testUtils.js";
import { clearPreviewTokensForTests } from "../features/writeLifecycle.js";
import {
  runConfigExportApply,
  runConfigExportPreview,
  runConfigExportVerify,
} from "../features/workflows/index.js";
import { createWriteFixture } from "./writeTestUtils.js";

describe("config export write workflow", () => {
  beforeEach(() => {
    clearPreviewTokensForTests();
  });

  it("previews, applies, and verifies a config export", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);

      const preview = await runConfigExportPreview(state);
      assert.equal(preview.status, "ok");
      assert.equal(preview.data?.preview.sync_directory, "config/sync");
      assert.equal(preview.data?.preview.drift_detected, true);
      assert.equal(preview.data?.preview.changed_items[0].name, "system.site");

      const apply = await runConfigExportApply(state, {
        preview_token: preview.data?.preview_token,
      });
      assert.equal(apply.status, "ok");
      assert.ok(apply.data?.result.changed_files.some((file) => file.endsWith("system.site.yml")));
      assert.equal(
        fs.readFileSync(path.join(fixture.syncDirectory, "system.site.yml"), "utf8"),
        "name: Exported\n",
      );

      const verify = await runConfigExportVerify(state);
      assert.equal(verify.status, "ok");
      assert.equal(verify.data?.verified, true);
      assert.equal(verify.data?.verification.drift_detected, false);
      assert.deepEqual(verify.data?.verification.changed_items, []);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects apply without a preview token", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);
      const response = await runConfigExportApply(state, {});

      assert.equal(response.status, "error");
      assert.equal(response.error?.code, "E_PREVIEW_REQUIRED");
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects reused preview tokens", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);
      const preview = await runConfigExportPreview(state);

      const firstApply = await runConfigExportApply(state, {
        preview_token: preview.data?.preview_token,
      });
      assert.equal(firstApply.status, "ok");

      const secondApply = await runConfigExportApply(state, {
        preview_token: preview.data?.preview_token,
      });
      assert.equal(secondApply.status, "error");
      assert.equal(secondApply.error?.code, "E_PREVIEW_CONSUMED");
    } finally {
      fixture.cleanup();
    }
  });
});
