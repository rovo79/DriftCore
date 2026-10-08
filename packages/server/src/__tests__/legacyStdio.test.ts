import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTempProject } from "./testUtils.js";

test("legacy executable writes action responses to stdout without feeding them back into stdin", () => {
  const fixture = createTempProject();
  try {
    const configPath = path.join(fixture.projectRoot, "driftcore.config.json");
    fs.writeFileSync(configPath, JSON.stringify(fixture.config));
    const result = spawnSync(process.execPath,
      [fileURLToPath(new URL("../bin/legacyStdio.js", import.meta.url))], {
        cwd: fixture.projectRoot,
        env: { ...process.env, DRIFTCORE_CONFIG: configPath },
        input: JSON.stringify({ id: 10, action: "composer_info" }) + "\n",
        encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024,
      });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    const responses = result.stdout.split("\n").filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));
    assert.equal(responses.length, 1, "one request must produce exactly one response");
    assert.equal(responses[0].id, 10);
    assert.equal(responses[0].action, "composer_info");
    assert.equal(responses[0].response.status, "ok");
    assert.equal(responses[0].response.data.manifest.name, "acme/site");
  } finally {
    fixture.cleanup();
  }
});
