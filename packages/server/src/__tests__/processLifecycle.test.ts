import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCliCommand } from "../features/sandboxExecution.js";

function createTempDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-process-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

describe("runCliCommand lifecycle", () => {
  it("times out a long-running process and stops further writes", async () => {
    const { dir, cleanup } = createTempDir();
    try {
      const sentinelPath = path.join(dir, "ticks.log");
      const script = `
        const fs = require("node:fs");
        const file = process.argv[1];
        fs.writeFileSync(file, "start\\n");
        setInterval(() => {
          fs.appendFileSync(file, "tick\\n");
        }, 20);
      `;

      const result = await runCliCommand({
        command: process.execPath,
        args: ["-e", script, sentinelPath],
        cwd: dir,
        timeoutMs: 300,
        maxParallel: 1,
      });

      assert.equal(result.timedOut, true);
      assert.equal(result.exitCode, null);
      assert.equal(fs.existsSync(sentinelPath), true);

      const sizeAfterTimeout = fs.statSync(sentinelPath).size;
      assert.ok(sizeAfterTimeout > 0);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const sizeAfterWait = fs.statSync(sentinelPath).size;
      assert.equal(sizeAfterWait, sizeAfterTimeout);
    } finally {
      cleanup();
    }
  });

  it("queues commands when maxParallel is one", async () => {
    const { dir, cleanup } = createTempDir();
    try {
      const secondMarker = path.join(dir, "second-started.txt");
      const firstScript = `
        setTimeout(() => {
          process.exit(0);
        }, 180);
      `;
      const secondScript = `
        const fs = require("node:fs");
        fs.writeFileSync(process.argv[1], "started");
      `;

      const start = Date.now();
      const firstPromise = runCliCommand({
        command: process.execPath,
        args: ["-e", firstScript],
        cwd: dir,
        timeoutMs: 1000,
        maxParallel: 1,
      });
      const secondPromise = runCliCommand({
        command: process.execPath,
        args: ["-e", secondScript, secondMarker],
        cwd: dir,
        timeoutMs: 1000,
        maxParallel: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 60));
      assert.equal(fs.existsSync(secondMarker), false);

      const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
      const elapsed = Date.now() - start;

      assert.equal(firstResult.exitCode, 0);
      assert.equal(secondResult.exitCode, 0);
      assert.equal(fs.existsSync(secondMarker), true);
      assert.ok(elapsed >= 180);
    } finally {
      cleanup();
    }
  });
});
