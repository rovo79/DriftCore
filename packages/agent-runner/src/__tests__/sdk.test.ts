import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateTypeScriptSDK } from "../sdk.js";

const resources = [
  {
    id: "schema.entityTypes",
    name: "Drupal entity type registry",
    description: "",
    mimeType: "application/json",
    data: { entityTypes: [{ machineName: "node", label: "Content", description: "", fields: [] }] },
  },
  {
    id: "config.exported",
    name: "Drupal exported configuration",
    description: "",
    mimeType: "application/json",
    data: { settings: { site: { name: "Example" } } },
  },
];

describe("generateTypeScriptSDK", () => {
  it("writes the SDK file to disk", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "driftcore-sdk-"));
    await generateTypeScriptSDK({ outputDir: outDir, resources, logger: console });
    const contents = await readFile(path.join(outDir, "driftcore-sdk.ts"), "utf8");
    assert.match(contents, /entityTypes/);
    assert.match(contents, /exportedConfiguration/);
  });
});
