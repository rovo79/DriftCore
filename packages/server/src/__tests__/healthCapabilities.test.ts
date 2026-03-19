import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMCPServer } from "../index.js";

function createTempConfig(): { configPath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-health-"));
  const drupalRoot = path.join(dir, "web");
  fs.mkdirSync(drupalRoot, { recursive: true });

  const configPath = path.join(dir, "driftcore.config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        drupalRoot,
        redaction: {
          enabled: true,
          placeholder: "[hidden]",
        },
        rateLimit: {
          windowMs: 30_000,
          maxRequests: 12,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    configPath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

describe("health endpoint capabilities", () => {
  it("reports configuration-dependent capability flags", async () => {
    const { configPath, cleanup } = createTempConfig();
    const server = createMCPServer({ logger: console, configPath });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as { port: number };
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      const health = (await response.json()) as {
        status: string;
        configured: boolean;
        capabilities: {
          local_only: boolean;
          redaction_enabled: boolean;
          rate_limiting_enabled: boolean;
          write_disabled: boolean;
        };
      };

      assert.equal(response.status, 200);
      assert.equal(health.status, "ok");
      assert.equal(health.configured, true);
      assert.equal(health.capabilities.local_only, true);
      assert.equal(health.capabilities.redaction_enabled, true);
      assert.equal(health.capabilities.rate_limiting_enabled, true);
      assert.equal(health.capabilities.write_disabled, false);
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      cleanup();
    }
  });
});
