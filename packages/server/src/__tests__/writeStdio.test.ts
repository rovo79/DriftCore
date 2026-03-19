import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { Interface } from "node:readline";
import { stdioTransport } from "../transports/stdio.js";
import { createState } from "./testUtils.js";
import { createWriteFixture } from "./writeTestUtils.js";

class MockReadline extends EventEmitter {
  public writes: string[] = [];

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
}

function parseLastResponse(mock: MockReadline) {
  const last = mock.writes[mock.writes.length - 1];
  return JSON.parse(last) as {
    id?: string | number;
    action: string;
    response: {
      status: string;
      data?: Record<string, unknown>;
      error?: { code?: string };
    };
  };
}

async function emitLine(mock: MockReadline, payload: unknown) {
  mock.emit("line", JSON.stringify(payload));
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitForWrites(mock: MockReadline, expectedCount: number) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (mock.writes.length >= expectedCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Timed out waiting for ${expectedCount} stdio writes`);
}

describe("write stdio actions", () => {
  it("supports preview/apply/verify for cache, scaffold, and config export", async () => {
    const fixture = createWriteFixture();
    const mock = new MockReadline();
    const transport = stdioTransport(mock as unknown as Interface, createState(fixture.config));

    try {
      await emitLine(mock, { id: 1, action: "cache_rebuild_preview" });
      await waitForWrites(mock, 1);
      let response = parseLastResponse(mock);
      assert.equal(response.action, "cache_rebuild_preview");
      assert.equal(response.response.status, "ok");
      const cachePreviewToken = String(response.response.data?.preview_token);

      await emitLine(mock, {
        id: 2,
        action: "cache_rebuild_apply",
        params: { preview_token: cachePreviewToken },
      });
      await waitForWrites(mock, 2);
      response = parseLastResponse(mock);
      assert.equal(response.action, "cache_rebuild_apply");
      assert.equal(response.response.status, "ok");

      await emitLine(mock, { id: 3, action: "cache_rebuild_verify" });
      await waitForWrites(mock, 3);
      response = parseLastResponse(mock);
      assert.equal(response.action, "cache_rebuild_verify");
      assert.equal(response.response.status, "ok");
      assert.equal(response.response.data?.verified, true);

      await emitLine(mock, {
        id: 4,
        action: "scaffold_preview",
        params: { machine_name: "acme_blog", target_type: "module" },
      });
      await waitForWrites(mock, 4);
      response = parseLastResponse(mock);
      assert.equal(response.action, "scaffold_preview");
      assert.equal(response.response.status, "ok");
      const scaffoldPreviewToken = String(response.response.data?.preview_token);

      await emitLine(mock, {
        id: 5,
        action: "scaffold_apply",
        params: {
          machine_name: "acme_blog",
          target_type: "module",
          preview_token: scaffoldPreviewToken,
        },
      });
      await waitForWrites(mock, 5);
      response = parseLastResponse(mock);
      assert.equal(response.action, "scaffold_apply");
      assert.equal(response.response.status, "ok");

      await emitLine(mock, {
        id: 6,
        action: "scaffold_verify",
        params: { machine_name: "acme_blog", target_type: "module" },
      });
      await waitForWrites(mock, 6);
      response = parseLastResponse(mock);
      assert.equal(response.action, "scaffold_verify");
      assert.equal(response.response.status, "ok");
      assert.equal(response.response.data?.verified, true);

      await emitLine(mock, { id: 7, action: "config_export_preview" });
      await waitForWrites(mock, 7);
      response = parseLastResponse(mock);
      assert.equal(response.action, "config_export_preview");
      assert.equal(response.response.status, "ok");
      const exportPreviewToken = String(response.response.data?.preview_token);

      await emitLine(mock, {
        id: 8,
        action: "config_export_apply",
        params: { preview_token: exportPreviewToken },
      });
      await waitForWrites(mock, 8);
      response = parseLastResponse(mock);
      assert.equal(response.action, "config_export_apply");
      assert.equal(response.response.status, "ok");

      await emitLine(mock, { id: 9, action: "config_export_verify" });
      await waitForWrites(mock, 9);
      response = parseLastResponse(mock);
      assert.equal(response.action, "config_export_verify");
      assert.equal(response.response.status, "ok");
      assert.equal(response.response.data?.verified, true);
    } finally {
      mock.emit("close");
      await transport;
      fixture.cleanup();
    }
  });
});
