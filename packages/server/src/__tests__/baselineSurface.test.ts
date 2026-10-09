import assert from "node:assert/strict";
import test from "node:test";
import { getComposerTools } from "../features/composerTools.js";
import { getDrushTools } from "../features/drushTools.js";
import { getWorkflowTools } from "../features/workflows/index.js";

test("internal DriftCore catalog retains the pre-MCP capability surface", () => {
  const names = [
    ...getDrushTools(),
    ...getComposerTools(),
    ...getWorkflowTools(),
  ].map((tool) => tool.name);

  assert.deepEqual(
    names.sort(),
    [
      "drift.cache_rebuild",
      "drift.composer_info",
      "drift.composer_outdated",
      "drift.config_drift_assessment",
      "drift.config_export",
      "drift.drush_pml",
      "drift.drush_status",
      "drift.module_scaffold",
      "drift.scaffold_plan",
      "drift.upgrade_assessment",
    ].sort(),
  );
});
