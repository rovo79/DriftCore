import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CliExecutionOptions, CliExecutionResult } from "../features/sandboxExecution.js";
import { runComposerOutdated } from "../features/composerTools.js";
import { runDrushStatus } from "../features/drushTools.js";
import { createState, createTempProject } from "./testUtils.js";

type RunnerStub = (options: CliExecutionOptions) => Promise<CliExecutionResult>;

function makeRunner(result: CliExecutionResult): RunnerStub {
  return async () => result;
}

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return output;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectStrings(nested, output);
    }
  }

  return output;
}

function assertNoAbsolutePaths(value: unknown) {
  const strings = collectStrings(value);
  for (const text of strings) {
    assert.equal(/(\/Users\/|\/home\/|\/var\/|[A-Za-z]:\\)/.test(text), false, text);
  }
}

describe("CLI error redaction", () => {
  it("removes absolute filesystem paths from tool error responses", async () => {
    const { config, cleanup } = createTempProject();
    try {
      config.drushPath = "/Users/test/bin/drush";
      config.composerPath = "/Users/test/bin/composer";
      config.redaction = {
        enabled: true,
        placeholder: "[redacted]",
      };

      const failingRunner: RunnerStub = makeRunner({
        stdout: "",
        stderr: "spawn /Users/test/bin/drush ENOENT at /Users/test/site/web",
        exitCode: 1,
        timedOut: false,
        durationMs: 4,
      });

      const drushResponse = await runDrushStatus(createState(config), failingRunner);
      assert.equal(drushResponse.status, "error");
      assertNoAbsolutePaths(drushResponse);

      const composerResponse = await runComposerOutdated(createState(config), failingRunner);
      assert.equal(composerResponse.status, "error");
      assertNoAbsolutePaths(composerResponse);
    } finally {
      cleanup();
    }
  });
});
