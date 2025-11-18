import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDrushStatus, runDrushPml } from "../features/drushTools.js";
import { runComposerInfo, runComposerOutdated } from "../features/composerTools.js";
import type { ServerConfig, ServerState } from "../types.js";
import type {
  CliExecutionOptions,
  CliExecutionResult,
} from "../features/sandboxExecution.js";

type RunnerStub = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

function createProject(): {
  config: ServerConfig;
  cleanup: () => void;
  sentinelPath: string;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "driftcore-nonwrite-"));
  const projectRoot = tmpDir;
  const drupalRoot = path.join(projectRoot, "web");
  fs.mkdirSync(drupalRoot, { recursive: true });

  fs.writeFileSync(
    path.join(projectRoot, "composer.json"),
    JSON.stringify({ name: "acme/site", require: { "drupal/token": "^1.0" } }, null, 2),
  );
  fs.writeFileSync(
    path.join(projectRoot, "composer.lock"),
    JSON.stringify({ packages: [{ name: "drupal/token", version: "1.0.0", type: "drupal-module" }] }, null, 2),
  );

  const sentinelPath = path.join(projectRoot, "SENTINEL.txt");
  fs.writeFileSync(sentinelPath, "original");

  const config: ServerConfig = {
    drupalRoot,
    customModuleDirs: ["web/modules/custom"],
    customThemeDirs: ["web/themes/custom"],
    cacheTtlMs: { projectManifest: 0, pml: 0 },
  };

  return {
    config,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
    sentinelPath,
  };
}

function createState(config: ServerConfig): ServerState {
  return {
    resources: [],
    tools: [],
    logger: console,
    config,
    runOperation: async (_meta, executor) => executor(),
  };
}

const runnerStub: RunnerStub = async () => ({
  stdout: JSON.stringify({}),
  stderr: "",
  exitCode: 0,
  timedOut: false,
  durationMs: 1,
});

describe("CLI tools non-write behavior", () => {
  it("does not modify project files", async () => {
    const { config, cleanup, sentinelPath } = createProject();
    try {
      const initialContent = fs.readFileSync(sentinelPath, "utf8");

      await runDrushStatus(createState(config), runnerStub);
      await runDrushPml(createState(config), runnerStub);
      await runComposerInfo(createState(config));
      await runComposerOutdated(createState(config), runnerStub);

      const finalContent = fs.readFileSync(sentinelPath, "utf8");
      assert.equal(finalContent, initialContent);
    } finally {
      cleanup();
    }
  });
});
