import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createState } from "./testUtils.js";
import { clearPreviewTokensForTests } from "../features/writeLifecycle.js";
import {
  runCacheRebuildApply,
  runCacheRebuildPreview,
  runCacheRebuildVerify,
} from "../features/workflows/index.js";
import { createWriteFixture } from "./writeTestUtils.js";

describe("cache rebuild write workflow", () => {
  beforeEach(() => {
    clearPreviewTokensForTests();
  });

  it("previews, applies, and verifies a cache rebuild", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);

      const preview = await runCacheRebuildPreview(state);
      assert.equal(preview.status, "ok");
      assert.equal(preview.data?.preview.command.includes("cache:rebuild"), true);
      assert.equal(preview.data?.preview.effect, "clears all Drupal caches");
      assert.equal(typeof preview.data?.preview_token, "string");

      const apply = await runCacheRebuildApply(state, {
        preview_token: preview.data?.preview_token,
      });
      assert.equal(apply.status, "ok");
      assert.equal(apply.data?.result.command.includes("cache:rebuild"), true);
      assert.equal(apply.data?.changes[0].type, "command_executed");

      const verify = await runCacheRebuildVerify(state);
      assert.equal(verify.status, "ok");
      assert.equal(verify.data?.verified, true);
      assert.equal(verify.data?.verification.drupal_version, "11.1.5");
      assert.equal(verify.data?.verification.responsive, true);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects apply without a preview token", async () => {
    const fixture = createWriteFixture();
    try {
      const state = createState(fixture.config);
      const response = await runCacheRebuildApply(state, {});

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
      const preview = await runCacheRebuildPreview(state);

      const firstApply = await runCacheRebuildApply(state, {
        preview_token: preview.data?.preview_token,
      });
      assert.equal(firstApply.status, "ok");

      const secondApply = await runCacheRebuildApply(state, {
        preview_token: preview.data?.preview_token,
      });
      assert.equal(secondApply.status, "error");
      assert.equal(secondApply.error?.code, "E_PREVIEW_CONSUMED");
    } finally {
      fixture.cleanup();
    }
  });
});
