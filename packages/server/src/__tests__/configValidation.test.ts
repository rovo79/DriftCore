import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadServerConfig } from "../config.js";

const logger = {
  info() {},
  warn() {},
  error() {},
};

function createTempDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-config-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

describe("loadServerConfig", () => {
  it("rejects an empty config object with E_CONFIG_INVALID_ROOT", () => {
    const { dir, cleanup } = createTempDir();
    try {
      const configPath = path.join(dir, "driftcore.config.json");
      fs.writeFileSync(configPath, JSON.stringify({}), "utf8");

      const result = loadServerConfig({ configPath, logger });
      assert.equal(result.config, null);
      assert.equal(result.error?.code, "E_CONFIG_INVALID_ROOT");
    } finally {
      cleanup();
    }
  });

  it("loads configuration even when unknown fields are present", () => {
    const { dir, cleanup } = createTempDir();
    try {
      const drupalRoot = path.join(dir, "web");
      fs.mkdirSync(drupalRoot, { recursive: true });

      const configPath = path.join(dir, "driftcore.config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            drupalRoot,
            extraField: "ignored",
          },
          null,
          2,
        ),
        "utf8",
      );

      const result = loadServerConfig({ configPath, logger });
      assert.equal(result.config?.drupalRoot, drupalRoot);
      assert.equal(result.error, undefined);
      assert.equal("extraField" in (result.config ?? {}), false);
      assert.equal(result.config?.timeouts?.drushStatusMs, 10000);
    } finally {
      cleanup();
    }
  });

  it("rejects a drupalRoot that points to a file", () => {
    const { dir, cleanup } = createTempDir();
    try {
      const drupalRoot = path.join(dir, "web");
      fs.writeFileSync(drupalRoot, "<?php", "utf8");

      const configPath = path.join(dir, "driftcore.config.json");
      fs.writeFileSync(configPath, JSON.stringify({ drupalRoot }), "utf8");

      const result = loadServerConfig({ configPath, logger });
      assert.equal(result.config, null);
      assert.equal(result.error?.code, "E_CONFIG_INVALID_ROOT");
      assert.match(result.error?.message ?? "", /not a directory/i);
    } finally {
      cleanup();
    }
  });
});
