import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listSchemaResources } from "../features/schemaResources.js";
import { getDrushTools } from "../features/drushTools.js";

describe("schema resources", () => {
  it("exposes the required Drupal resources", () => {
    const resources = listSchemaResources();
    const ids = resources.map((resource) => resource.id);
    assert.ok(ids.includes("schema.entityTypes"));
    assert.ok(ids.includes("config.exported"));
     assert.ok(ids.includes("project_manifest"));
  });
});

describe("drush tools", () => {
  it("includes drift.drush_status tool definition", () => {
    const tools = getDrushTools();
    const statusTool = tools.find((tool) => tool.name === "drift.drush_status");
    assert.ok(statusTool, "drift.drush_status tool should be defined");
    assert.ok(statusTool?.args?.includes("--format=json"));
  });
});
