import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CliExecutionOptions, CliExecutionResult } from "../features/sandboxExecution.js";
import { runComposerOutdated } from "../features/composerTools.js";
import { runDrushPml, runDrushStatus } from "../features/drushTools.js";
import { createState, createTempProject } from "./testUtils.js";

type RunnerStub = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

function makeRunner(result: CliExecutionResult): RunnerStub {
  return async () => result;
}

function createBinaryGarbage(): string {
  return Buffer.from([0xff, 0xfe, 0x00, 0x13, 0x7f]).toString("latin1");
}

describe("CLI resilience", () => {
  it("returns JSON parse errors for malformed drush status output", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const cases = [
        { name: "empty stdout", stdout: "" },
        { name: "warning preamble", stdout: "Warning: something\n" },
        { name: "truncated json", stdout: "{\"drupal-version\": \"11." },
        { name: "binary garbage", stdout: createBinaryGarbage() },
      ];

      for (const testCase of cases) {
        const response = await runDrushStatus(
          createState(config),
          makeRunner({
            stdout: testCase.stdout,
            stderr: "",
            exitCode: 0,
            timedOut: false,
            durationMs: 1,
          }),
        );

        assert.equal(response.status, "error", testCase.name);
        assert.equal(response.error?.code, "E_JSON_PARSE", testCase.name);
      }
    } finally {
      cleanup();
    }
  });

  it("truncates drush stderr when parse failures are noisy", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runDrushStatus(
        createState(config),
        makeRunner({
          stdout: "",
          stderr: "x".repeat(10_000),
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
        }),
      );

      assert.equal(response.status, "error");
      assert.equal(response.error?.code, "E_JSON_PARSE");
      assert.equal(response.error?.stderr?.length, 2001);
      assert.equal(response.error?.stderr?.endsWith("…"), true);
    } finally {
      cleanup();
    }
  });

  it("treats an array payload from drush pm:list as an empty result", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runDrushPml(
        createState(config),
        makeRunner({
          stdout: "[]",
          stderr: "",
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
        }),
      );

      assert.equal(response.status, "ok");
      assert.deepEqual(response.data?.modules, []);
      assert.deepEqual(response.data?.themes, []);
    } finally {
      cleanup();
    }
  });

  it("classifies drush pm:list entries with missing type metadata as unknown", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runDrushPml(
        createState(config),
        makeRunner({
          stdout: JSON.stringify({
            modules: {
              node: { status: "Enabled", path: "core/modules/node" },
            },
            themes: {
              claro: { status: "Enabled", path: "core/themes/claro" },
            },
          }),
          stderr: "",
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
        }),
      );

      assert.equal(response.status, "ok");
      assert.equal(response.data?.modules[0]?.name, "node");
      assert.equal(response.data?.modules[0]?.type, "unknown");
      assert.equal(response.data?.modules[0]?.status, "enabled");
      assert.equal(response.data?.themes[0]?.name, "claro");
      assert.equal(response.data?.themes[0]?.type, "unknown");
    } finally {
      cleanup();
    }
  });

  it("parses composer outdated output after a noisy preamble", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerOutdated(
        createState(config),
        makeRunner({
          stdout:
            "Cannot create cache directory\n" +
            JSON.stringify({
              installed: [
                {
                  name: "drupal/token",
                  version: "1.11.0",
                  latest: "1.12.0",
                  "latest-status": "semver-safe-update",
                },
              ],
            }),
          stderr: "",
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
        }),
      );

      assert.equal(response.status, "ok");
      assert.equal(response.data?.packages[0]?.name, "drupal/token");
      assert.equal(response.data?.packages[0]?.latest_status, "semver-safe-update");
    } finally {
      cleanup();
    }
  });

  it("returns a parse error when composer outdated output has no JSON", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerOutdated(
        createState(config),
        makeRunner({
          stdout: "Composer output without JSON",
          stderr: "",
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
        }),
      );

      assert.equal(response.status, "error");
      assert.equal(response.error?.code, "E_JSON_PARSE");
    } finally {
      cleanup();
    }
  });

  it("returns an empty package list when composer outdated reports null installed data", async () => {
    const { config, cleanup } = createTempProject();
    try {
      const response = await runComposerOutdated(
        createState(config),
        makeRunner({
          stdout: JSON.stringify({ installed: null }),
          stderr: "",
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
        }),
      );

      assert.equal(response.status, "ok");
      assert.deepEqual(response.data?.packages, []);
    } finally {
      cleanup();
    }
  });
});
