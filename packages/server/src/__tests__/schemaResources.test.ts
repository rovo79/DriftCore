import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listDiscoveredResources } from "../features/discoveredResources.js";
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

  it("labels static resources as template sources", () => {
    const resources = listSchemaResources();
    for (const resource of resources) {
      assert.equal(resource.source, "template");
      assert.equal(typeof resource.id, "string");
      assert.equal(typeof resource.name, "string");
      assert.equal(typeof resource.description, "string");
      assert.equal(typeof resource.mimeType, "string");
      assert.ok("data" in resource);
    }
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

describe("discovered resources", () => {
  it("lists the dynamic project truth resources", () => {
    const resources = listDiscoveredResources();
    const ids = resources.map((resource) => resource.id);
    assert.ok(ids.includes("project_modules"));
    assert.ok(ids.includes("project_config_layout"));
    assert.ok(ids.includes("project_checks"));
    for (const resource of resources) {
      assert.equal(resource.source, "discovered");
    }
  });
});
