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
  });
});

describe("drush tools", () => {
  it("includes cache rebuild command", () => {
    const tools = getDrushTools();
    const cacheTool = tools.find((tool) => tool.name === "drush.cacheRebuild");
    assert.ok(cacheTool, "drush.cacheRebuild tool should be defined");
    assert.equal(cacheTool?.command, "drush cache:rebuild");
  });
});
