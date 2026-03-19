import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import type { Interface } from "node:readline";
import type { AddressInfo } from "node:net";
import { createMCPServer } from "../index.js";
import { validateBinaryPaths } from "../config.js";
import { createRateLimiter } from "../features/rateLimiter.js";
import { mapCliResultToError, redactPaths } from "../features/errorMapping.js";
import { stdioTransport } from "../transports/stdio.js";
import type { CliExecutionResult } from "../features/sandboxExecution.js";
import type { ServerConfig, ServerState } from "../types.js";

function createTempProjectWithConfig(partial: Partial<ServerConfig> = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-security-"));
  const drupalRoot = path.join(tmpDir, "web");
  fs.mkdirSync(drupalRoot, { recursive: true });

  const config = {
    drupalRoot,
    ...partial,
  } satisfies ServerConfig;

  const configPath = path.join(tmpDir, "driftcore.config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    configPath,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}

function createState(): ServerState {
  return {
    resources: [],
    tools: [],
    logger: console,
    config: null,
    binaryValidation: {
      drush: { resolved: null, exists: false },
      composer: { resolved: null, exists: false },
    },
    runOperation: async (_meta, executor) => executor(),
  };
}

describe("security baseline", () => {
  it("binds HTTP server to 127.0.0.1 by default", async () => {
    const server = createMCPServer({ logger: console });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as AddressInfo;
      assert.equal(address.address, "127.0.0.1");
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("redacts filesystem paths when redaction is enabled", () => {
    const cliResult: CliExecutionResult = {
      stdout: "",
      stderr: "spawn /Users/test/bin/drush ENOENT",
      exitCode: null,
      timedOut: false,
      durationMs: 4,
    };

    const response = mapCliResultToError(cliResult, {
      command: "/Users/test/bin/drush",
      args: ["status", "--format=json"],
      cwd: "/Users/test/site/web",
    }, {
      missingBinaryCode: "E_DRUSH_NOT_FOUND",
      missingBinaryMessage: "Drush executable missing",
    }, {
      enabled: true,
      placeholder: "[hidden]",
    });

    assert.equal(response.status, "error");
    assert.ok(response.error);
    assert.equal(response.error.code, "E_DRUSH_NOT_FOUND");
    assert.ok(response.error.stderr?.includes("[hidden]"));
    assert.equal(response.error.stderr?.includes("/Users/test"), false);
    assert.equal(String(response.error.diagnostics?.cwd).includes("/Users/test"), false);
  });

  it("keeps paths unchanged when redaction is disabled", () => {
    const input = "error at /Users/test/project/file.txt";
    const output = redactPaths(input, { enabled: false, placeholder: "[hidden]" });
    assert.equal(output, input);
  });

  it("enforces per-IP rate limiter limits", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
    assert.equal(limiter.isAllowed("127.0.0.1"), true);
    assert.equal(limiter.isAllowed("127.0.0.1"), true);
    assert.equal(limiter.isAllowed("127.0.0.1"), false);
  });

  it("returns HTTP 429 when rate limit is exceeded", async () => {
    const { configPath, cleanup } = createTempProjectWithConfig({
      rateLimit: { windowMs: 60000, maxRequests: 1 },
    });

    const server = createMCPServer({ logger: console, configPath });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const first = await fetch(`${baseUrl}/health`);
      assert.equal(first.status, 200);

      const second = await fetch(`${baseUrl}/health`);
      assert.equal(second.status, 429);
      const body = await second.json();
      assert.equal(body.status, "error");
      assert.equal(body.error?.code, "E_RATE_LIMITED");
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      cleanup();
    }
  });

  it("rejects requests with Origin header", async () => {
    const { configPath, cleanup } = createTempProjectWithConfig();
    const server = createMCPServer({ logger: console, configPath });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const response = await fetch(`${baseUrl}/health`, {
        headers: { Origin: "https://example.com" },
      });
      assert.equal(response.status, 403);
      const body = await response.json();
      assert.equal(body.status, "error");
      assert.equal(body.error?.code, "E_ORIGIN_REJECTED");
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      cleanup();
    }
  });

  it("rejects oversized POST bodies on write routes", async () => {
    const server = createMCPServer({ logger: console });
    const httpServer = await server.handleHttp(0);

    try {
      const address = httpServer.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const response = await fetch(`${baseUrl}/workflows/cache-rebuild/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_token: "x".repeat(70_000) }),
      });

      assert.equal(response.status, 413);
      const body = await response.json();
      assert.equal(body.status, "error");
      assert.equal(body.error?.code, "E_REQUEST_TOO_LARGE");
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("rejects STDIO lines larger than 1 MB", async () => {
    class MockReadline extends EventEmitter {
      public writes: string[] = [];

      write(chunk: string): boolean {
        this.writes.push(chunk);
        return true;
      }
    }

    const mock = new MockReadline();
    const transportPromise = stdioTransport(mock as unknown as Interface, createState());

    mock.emit("line", "a".repeat(1048577));
    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(mock.writes.length > 0);
    const firstResponse = JSON.parse(mock.writes[0]);
    assert.equal(firstResponse.status, "error");
    assert.equal(firstResponse.error?.code, "E_INPUT_TOO_LARGE");

    mock.emit("close");
    await transportPromise;
  });

  it("reports binary validation for missing and present executables", () => {
    const missing = validateBinaryPaths({
      drupalRoot: process.cwd(),
      drushPath: "/this/path/does/not/exist/drush",
      composerPath: "/this/path/does/not/exist/composer",
    });

    assert.equal(missing.drush.exists, false);
    assert.equal(missing.composer.exists, false);

    const present = validateBinaryPaths({
      drupalRoot: process.cwd(),
      drushPath: process.execPath,
      composerPath: process.execPath,
    });

    assert.equal(present.drush.exists, true);
    assert.equal(present.composer.exists, true);
  });
});
